/**
 * Database seeder — populates ALL tables with realistic, comprehensive development data.
 *
 * Usage:
 *   npm run db:seed
 *
 * Coverage:
 *   - 2 admins, 5 providers, 8 patients (+2 edge-case accounts)
 *   - 90 days of symptom, jaw-mobility, sleep and medication history per patient
 *   - All optional columns filled: phone, avatar_url, fcm_token, diagnosis, photo_url, etc.
 *   - Every table seeded: clinical_notes, clinic_visits, report_requests, intake_forms,
 *     intake_form_assignments, intake_responses, broadcasts, scheduled_reports,
 *     feature_flags, support_tickets, job_runs, notification_outbox
 *
 * Idempotent: truncates all tables before inserting.
 * NEVER run against production — the script checks NODE_ENV.
 */
// Mirror env loader in src/config/env.ts: .env.${NODE_ENV} first, .env fallback.
import * as dotenv from 'dotenv';
const nodeEnv = process.env.NODE_ENV ?? 'development';
dotenv.config({ path: `.env.${nodeEnv}` });
dotenv.config({ path: '.env' });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, createCipheriv } from 'crypto';
import * as schema from '../src/db/schema';

// ─── Safety check ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('[FATAL] Cannot seed a production database.');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL; 
if (!DATABASE_URL) {
  console.error('[FATAL] DATABASE_URL is not set.');
  process.exit(1);
}

const MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY;
if (!MFA_ENCRYPTION_KEY || MFA_ENCRYPTION_KEY.length !== 64) {
  console.error('[FATAL] MFA_ENCRYPTION_KEY must be a 64-char hex string.');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const SEED_PASSWORD = 'Test@1234!';

async function hashPw(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function encryptCode(plaintext: string): string {
  const key = Buffer.from(MFA_ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

// ─── Main ──────────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  const db = drizzle(pool, { schema });

  console.log('Truncating all tables…');
  await pool.query(`
    TRUNCATE TABLE
      users, profiles, provider_details,
      refresh_tokens, sessions, mfa_backup_codes, password_resets,
      linking_codes, patient_provider_links,
      exercises, exercise_assignments, exercise_completions,
      symptom_logs, reports, report_responses,
      clinical_notes, clinic_visits, report_requests,
      intake_forms, intake_form_assignments, intake_responses,
      notifications, notification_preferences, notification_outbox, reminders,
      audit_logs, login_events, idempotency_keys,
      job_runs, broadcasts, scheduled_reports, feature_flags, support_tickets,
      jaw_mobility_logs, medication_logs, sleep_logs
    RESTART IDENTITY CASCADE
  `);

  const passwordHash = await hashPw(SEED_PASSWORD);
  console.log(`All seed users share password: ${SEED_PASSWORD}`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. USERS + PROFILES + PROVIDER DETAILS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding users…');

  // ─── Admins ───────────────────────────────────────────────────────────────────
  const [admin] = await db.insert(schema.users).values({
    email: 'admin@tmjconnect.dev',
    password_hash: passwordHash,
    role: 'admin',
    phone: '+15125550001',
    email_verified: true,
    is_active: true,
    mfa_enabled: true,
    mfa_secret: encryptCode('JBSWY3DPEHPK3PXP'),
    fcm_token: 'fcm-admin-token-001',
    tos_accepted_at: daysAgo(90),
    tos_version: '1.0',
  }).returning({ id: schema.users.id, email: schema.users.email });

  await db.insert(schema.profiles).values({
    user_id: admin.id,
    first_name: 'Admin',
    last_name: 'User',
    timezone: 'America/Chicago',
    avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=AdminUser',
    city: 'Austin',
    state: 'TX',
  });

  const [admin2] = await db.insert(schema.users).values({
    email: 'ops@tmjconnect.dev',
    password_hash: passwordHash,
    role: 'admin',
    phone: '+15125550002',
    email_verified: true,
    is_active: true,
    mfa_enabled: true,
    mfa_secret: encryptCode('JBSWY3DPEHPK3PXP'),
    fcm_token: 'fcm-admin-token-002',
    tos_accepted_at: daysAgo(60),
    tos_version: '1.0',
  }).returning({ id: schema.users.id, email: schema.users.email });

  await db.insert(schema.profiles).values({
    user_id: admin2.id,
    first_name: 'Operations',
    last_name: 'Manager',
    timezone: 'America/New_York',
    avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=OpsManager',
    city: 'New York',
    state: 'NY',
  });

  const admins = [admin, admin2];

  // ─── Providers ────────────────────────────────────────────────────────────────
  const providerData = [
    {
      email: 'dr.smith@tmjconnect.dev',
      first: 'Sarah', last: 'Smith',
      phone: '+15125550010',
      license: 'TX-DDS-001', type: 'DDS', specialty: 'Orofacial Pain',
      clinic: 'Austin TMJ Center',
      credentials: ['DDS', 'FAAOP', 'CCMC'],
      city: 'Austin', state: 'TX', tz: 'America/Chicago',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=SarahSmith',
    },
    {
      email: 'dr.jones@tmjconnect.dev',
      first: 'Michael', last: 'Jones',
      phone: '+12145550020',
      license: 'TX-DDS-002', type: 'DMD', specialty: 'Oral Surgery',
      clinic: 'Dallas Jaw Clinic',
      credentials: ['DMD', 'OMFS'],
      city: 'Dallas', state: 'TX', tz: 'America/Chicago',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=MichaelJones',
    },
    {
      email: 'dr.chen@tmjconnect.dev',
      first: 'Lisa', last: 'Chen',
      phone: '+14155550030',
      license: 'CA-PT-003', type: 'PT', specialty: 'Physical Therapy',
      clinic: 'SF Pain Relief Center',
      credentials: ['DPT', 'OCS', 'FAAOMPT'],
      city: 'San Francisco', state: 'CA', tz: 'America/Los_Angeles',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=LisaChen',
    },
    {
      email: 'dr.patel@tmjconnect.dev',
      first: 'Raj', last: 'Patel',
      phone: '+13035550040',
      license: 'CO-DDS-004', type: 'DDS', specialty: 'Craniofacial Pain',
      clinic: 'Denver Craniofacial Institute',
      credentials: ['DDS', 'MS', 'FAAOP'],
      city: 'Denver', state: 'CO', tz: 'America/Denver',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=RajPatel',
    },
    {
      email: 'dr.nguyen@tmjconnect.dev',
      first: 'Mei', last: 'Nguyen',
      phone: '+17135550050',
      license: 'TX-OT-005', type: 'OT', specialty: 'Occupational Therapy',
      clinic: 'Houston Jaw & Neck Rehab',
      credentials: ['OTD', 'CHT'],
      city: 'Houston', state: 'TX', tz: 'America/Chicago',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=MeiNguyen',
    },
  ];

  const providers: { id: string; email: string }[] = [];
  for (const p of providerData) {
    const [user] = await db.insert(schema.users).values({
      email: p.email,
      password_hash: passwordHash,
      role: 'provider',
      phone: p.phone,
      email_verified: true,
      is_active: true,
      mfa_enabled: true,
      mfa_secret: encryptCode('JBSWY3DPEHPK3PXP'),
      fcm_token: `fcm-provider-${providers.length + 1}`,
      tos_accepted_at: daysAgo(randomInt(60, 120)),
      tos_version: '1.0',
    }).returning({ id: schema.users.id });

    await db.insert(schema.profiles).values({
      user_id: user.id,
      first_name: p.first,
      last_name: p.last,
      timezone: p.tz,
      avatar_url: p.avatar,
      city: p.city,
      state: p.state,
    });

    await db.insert(schema.providerDetails).values({
      user_id: user.id,
      license_number: p.license,
      license_type: p.type,
      specialty: p.specialty,
      clinic_name: p.clinic,
      credentials: p.credentials,
    });

    providers.push({ id: user.id, email: p.email });
  }

  // ─── Patients ─────────────────────────────────────────────────────────────────
  const patientData = [
    { email: 'alice@tmjconnect.dev',   first: 'Alice',   last: 'Johnson',  phone: '+15125551001', dob: '1990-03-15', gender: 'female', city: 'Austin',        state: 'TX', tz: 'America/Chicago',     avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=AliceJohnson' },
    { email: 'bob@tmjconnect.dev',     first: 'Bob',     last: 'Williams', phone: '+12145551002', dob: '1985-07-22', gender: 'male',   city: 'Dallas',        state: 'TX', tz: 'America/Chicago',     avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=BobWilliams' },
    { email: 'carol@tmjconnect.dev',   first: 'Carol',   last: 'Davis',    phone: '+14155551003', dob: '1995-11-08', gender: 'female', city: 'San Francisco', state: 'CA', tz: 'America/Los_Angeles', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=CarolDavis' },
    { email: 'dave@tmjconnect.dev',    first: 'Dave',    last: 'Martinez', phone: '+17135551004', dob: '1988-01-30', gender: 'male',   city: 'Houston',       state: 'TX', tz: 'America/Chicago',     avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=DaveMartinez' },
    { email: 'eva@tmjconnect.dev',     first: 'Eva',     last: 'Brown',    phone: '+13035551005', dob: '1992-09-05', gender: 'female', city: 'Denver',        state: 'CO', tz: 'America/Denver',      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=EvaBrown' },
    { email: 'frank@tmjconnect.dev',   first: 'Frank',   last: 'Lee',      phone: '+16025551006', dob: '1978-04-18', gender: 'male',   city: 'Phoenix',       state: 'AZ', tz: 'America/Phoenix',     avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=FrankLee' },
    { email: 'grace@tmjconnect.dev',   first: 'Grace',   last: 'Kim',      phone: '+15035551007', dob: '2000-12-01', gender: 'female', city: 'Portland',      state: 'OR', tz: 'America/Los_Angeles', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=GraceKim' },
    { email: 'henry@tmjconnect.dev',   first: 'Henry',   last: 'Taylor',   phone: '+12025551008', dob: '1970-06-25', gender: 'male',   city: 'Washington',    state: 'DC', tz: 'America/New_York',    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=HenryTaylor' },
  ];

  const patients: { id: string; email: string }[] = [];
  for (const p of patientData) {
    const [user] = await db.insert(schema.users).values({
      email: p.email,
      password_hash: passwordHash,
      role: 'patient',
      phone: p.phone,
      email_verified: true,
      is_active: true,
      mfa_enabled: false,
      fcm_token: `fcm-patient-${patients.length + 1}`,
      tos_accepted_at: daysAgo(randomInt(14, 90)),
      tos_version: '1.0',
    }).returning({ id: schema.users.id });

    await db.insert(schema.profiles).values({
      user_id: user.id,
      first_name: p.first,
      last_name: p.last,
      date_of_birth: p.dob,
      gender: p.gender,
      avatar_url: p.avatar,
      city: p.city,
      state: p.state,
      timezone: p.tz,
    });

    patients.push({ id: user.id, email: p.email });
  }

  // Unverified patient (testing registration flow).
  const [unverified] = await db.insert(schema.users).values({
    email: 'newuser@tmjconnect.dev',
    password_hash: passwordHash,
    role: 'patient',
    phone: '+15125559001',
    email_verified: false,
    is_active: true,
    email_verify_code: encryptCode('123456'),
    email_verify_expires: daysFromNow(1),
  }).returning({ id: schema.users.id });

  await db.insert(schema.profiles).values({
    user_id: unverified.id,
    first_name: 'New',
    last_name: 'User',
    timezone: 'America/Chicago',
    city: 'Austin',
    state: 'TX',
  });

  // Deactivated patient (testing admin deactivation).
  const [deactivated] = await db.insert(schema.users).values({
    email: 'deactivated@tmjconnect.dev',
    password_hash: passwordHash,
    role: 'patient',
    phone: '+15125559002',
    email_verified: true,
    is_active: false,
    tos_accepted_at: daysAgo(180),
    tos_version: '1.0',
  }).returning({ id: schema.users.id, email: schema.users.email });

  await db.insert(schema.profiles).values({
    user_id: deactivated.id,
    first_name: 'Deactivated',
    last_name: 'Account',
    timezone: 'America/Chicago',
    city: 'Dallas',
    state: 'TX',
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. NOTIFICATION PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding notification preferences…');

  const allActiveUsers = [...admins, ...providers, ...patients];
  await db.insert(schema.notificationPreferences).values(
    allActiveUsers.map((u, i) => ({
      user_id: u.id,
      exercise_reminders: true,
      symptom_checkin: true,
      provider_messages: true,
      report_updates: true,
      tips_updates: i % 2 === 0,
      email_digest: (['instant', 'daily', 'weekly'] as const)[i % 3],
      next_digest_at: daysFromNow(1),
    })),
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. SESSIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding sessions…');

  const devices = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/120.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome Mobile/120.0',
  ];
  const ips = ['192.168.1.10', '192.168.1.20', '10.0.0.5', '203.0.113.42'];

  for (const u of [...providers, ...admins, ...patients.slice(0, 4)]) {
    await db.insert(schema.sessions).values({
      user_id: u.id,
      device_info: devices[randomInt(0, devices.length)],
      ip_address: ips[randomInt(0, ips.length)],
      last_active: hoursAgo(randomInt(0, 8)),
      expires_at: daysFromNow(7),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. REFRESH TOKENS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding refresh tokens…');

  for (const u of allActiveUsers) {
    const family = randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    await db.insert(schema.refreshTokens).values({
      user_id: u.id,
      token_hash: hashToken(randomBytes(64).toString('hex')),
      token_family: family,
      device_info: devices[randomInt(0, devices.length)],
      ip_address: ips[randomInt(0, ips.length)],
      expires_at: daysFromNow(7),
    });
    // Revoked token (rotation history).
    await db.insert(schema.refreshTokens).values({
      user_id: u.id,
      token_hash: hashToken(randomBytes(64).toString('hex')),
      token_family: family,
      device_info: devices[randomInt(0, devices.length)],
      ip_address: ips[randomInt(0, ips.length)],
      expires_at: daysFromNow(7),
      revoked_at: hoursAgo(randomInt(1, 48)),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. MFA BACKUP CODES (providers + admins)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding MFA backup codes…');

  for (const u of [...providers, ...admins]) {
    const codes = Array.from({ length: 10 }, () => randomBytes(5).toString('hex'));
    const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));
    await db.insert(schema.mfaBackupCodes).values(
      hashed.map((h, i) => ({
        user_id: u.id,
        code_hash: h,
        used: i === 0, // First code already used.
        used_at: i === 0 ? daysAgo(randomInt(5, 30)) : null,
      })),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. PATIENT-PROVIDER LINKS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding patient-provider links…');

  // Dr. Smith  → Alice, Bob, Dave, Frank
  // Dr. Jones  → Bob, Carol, Grace
  // Dr. Chen   → Carol, Eva, Grace
  // Dr. Patel  → Dave, Henry, Frank
  // Dr. Nguyen → Eva, Henry, Alice
  const linkDefs = [
    { patient: patients[0], provider: providers[0], diagnosis: 'TMJ disc displacement with reduction, chronic bruxism' },
    { patient: patients[1], provider: providers[0], diagnosis: 'Myofascial pain dysfunction syndrome' },
    { patient: patients[3], provider: providers[0], diagnosis: 'Bilateral TMJ arthralgia, stress-related clenching' },
    { patient: patients[5], provider: providers[0], diagnosis: 'TMJ osteoarthritis, limited mouth opening 28mm' },
    { patient: patients[1], provider: providers[1], diagnosis: 'Post-operative TMJ arthroscopy follow-up' },
    { patient: patients[2], provider: providers[1], diagnosis: 'Disc displacement without reduction, acute phase' },
    { patient: patients[6], provider: providers[1], diagnosis: 'Juvenile idiopathic arthritis affecting TMJ' },
    { patient: patients[2], provider: providers[2], diagnosis: 'Cervical spine dysfunction contributing to TMJ pain' },
    { patient: patients[4], provider: providers[2], diagnosis: 'Fibromyalgia with TMJ involvement' },
    { patient: patients[6], provider: providers[2], diagnosis: 'Forward head posture, TMJ and cervical pain' },
    { patient: patients[3], provider: providers[3], diagnosis: 'Mixed TMJ disorder — myogenous and arthrogenous' },
    { patient: patients[7], provider: providers[3], diagnosis: 'Chronic daily headache with TMJ etiology' },
    { patient: patients[5], provider: providers[3], diagnosis: 'Sleep bruxism with dental attrition and TMJ pain' },
    { patient: patients[4], provider: providers[4], diagnosis: 'Upper extremity dysfunction affecting jaw posture' },
    { patient: patients[7], provider: providers[4], diagnosis: 'Work-related TMJ strain, keyboard operator' },
    { patient: patients[0], provider: providers[4], diagnosis: 'Chronic pain syndrome, TMJ component' },
  ];

  const linkIds: string[] = [];
  for (const l of linkDefs) {
    const [row] = await db.insert(schema.patientProviderLinks).values({
      patient_id: l.patient.id,
      provider_id: l.provider.id,
      linked_at: daysAgo(randomInt(30, 120)),
      consent_scope: 'full_clinical',
      diagnosis: l.diagnosis,
    }).returning({ id: schema.patientProviderLinks.id });
    linkIds.push(row.id);
  }

  // Historical disconnected links.
  await db.insert(schema.patientProviderLinks).values([
    { patient_id: patients[0].id, provider_id: providers[1].id, linked_at: daysAgo(180), unlinked_at: daysAgo(90), consent_scope: 'full_clinical', diagnosis: 'Former patient — transferred care' },
    { patient_id: patients[3].id, provider_id: providers[2].id, linked_at: daysAgo(150), unlinked_at: daysAgo(60), consent_scope: 'full_clinical', diagnosis: 'PT completed — discharged' },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. LINKING CODES
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding linking codes…');

  await db.insert(schema.linkingCodes).values([
    { code: 'ABC123', provider_id: providers[0].id, status: 'pending',   expires_at: daysFromNow(7) },
    { code: 'XYZ789', provider_id: providers[1].id, status: 'pending',   expires_at: daysFromNow(5) },
    { code: 'DEF456', provider_id: providers[2].id, status: 'pending',   expires_at: daysFromNow(3) },
    { code: 'GHI012', provider_id: providers[3].id, status: 'pending',   expires_at: daysFromNow(6) },
    { code: 'JKL345', provider_id: providers[4].id, status: 'pending',   expires_at: daysFromNow(4) },
    { code: 'OLD001', provider_id: providers[0].id, status: 'expired',   expires_at: daysAgo(1) },
    { code: 'OLD002', provider_id: providers[1].id, status: 'expired',   expires_at: daysAgo(3) },
    { code: 'USE001', provider_id: providers[2].id, patient_id: patients[4].id, status: 'connected', expires_at: daysAgo(3) },
    { code: 'USE002', provider_id: providers[3].id, patient_id: patients[7].id, status: 'connected', expires_at: daysAgo(10) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. EXERCISES
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding exercises…');

  const exerciseData = [
    { provider: providers[0], title: 'Jaw Stretch (Lateral)', desc: 'Gently move your jaw side to side while keeping your mouth slightly open.', dur: 120, cat: 'Stretching', inst: '1. Open mouth slightly\n2. Move jaw to the left, hold 5 seconds\n3. Return to center\n4. Move jaw to the right, hold 5 seconds\n5. Repeat 10 times', video: 'https://example.com/videos/jaw-lateral.mp4', thumb: 'https://example.com/thumbs/jaw-lateral.jpg' },
    { provider: providers[0], title: 'Chin Tuck', desc: 'Pull your chin straight back while keeping your head level.', dur: 60, cat: 'Posture', inst: '1. Sit upright\n2. Pull chin straight back\n3. Hold for 5 seconds\n4. Release\n5. Repeat 10 times', video: 'https://example.com/videos/chin-tuck.mp4', thumb: 'https://example.com/thumbs/chin-tuck.jpg' },
    { provider: providers[0], title: 'Mouth Opening (Resistance)', desc: 'Open your mouth against gentle thumb resistance.', dur: 90, cat: 'Strengthening', inst: '1. Place thumb under chin\n2. Open mouth slowly against resistance\n3. Hold 5 seconds\n4. Close slowly\n5. Repeat 10 times', video: 'https://example.com/videos/mouth-resistance.mp4', thumb: 'https://example.com/thumbs/mouth-resistance.jpg' },
    { provider: providers[1], title: 'Neck Side Bend', desc: 'Tilt your head to one side to stretch the neck muscles connected to the jaw.', dur: 60, cat: 'Stretching', inst: '1. Sit upright\n2. Tilt head to left\n3. Hold 15 seconds\n4. Return to center\n5. Repeat on right side\n6. Do 5 sets', video: 'https://example.com/videos/neck-bend.mp4', thumb: 'https://example.com/thumbs/neck-bend.jpg' },
    { provider: providers[1], title: 'Mandibular Range of Motion', desc: 'Controlled jaw opening and closing to restore normal range.', dur: 90, cat: 'Mobility', inst: '1. Place fingers on chin\n2. Slowly open mouth as wide as comfortable\n3. Pause 2 seconds\n4. Close slowly\n5. Repeat 15 times', video: 'https://example.com/videos/mandibular-rom.mp4', thumb: 'https://example.com/thumbs/mandibular-rom.jpg' },
    { provider: providers[2], title: 'Tongue Up Exercise', desc: 'Place tongue on the roof of your mouth while opening and closing.', dur: 45, cat: 'Coordination', inst: '1. Place tongue on the roof of mouth\n2. Slowly open mouth wide\n3. Slowly close\n4. Keep tongue in position throughout\n5. Repeat 15 times', video: 'https://example.com/videos/tongue-up.mp4', thumb: 'https://example.com/thumbs/tongue-up.jpg' },
    { provider: providers[2], title: 'Relaxation Breathing', desc: 'Deep breathing to reduce jaw tension and clenching.', dur: 180, cat: 'Relaxation', inst: '1. Sit comfortably with lips apart\n2. Inhale through nose for 4 counts\n3. Hold for 4 counts\n4. Exhale through mouth for 6 counts\n5. Repeat for 3 minutes', video: 'https://example.com/videos/relaxation.mp4', thumb: 'https://example.com/thumbs/relaxation.jpg' },
    { provider: providers[3], title: 'Scalene Stretch', desc: 'Stretch the scalene muscles to relieve neck tension contributing to jaw pain.', dur: 60, cat: 'Stretching', inst: '1. Sit upright\n2. Tilt ear to shoulder\n3. Rotate chin slightly up\n4. Hold 20 seconds\n5. Repeat both sides 3 times', video: 'https://example.com/videos/scalene.mp4', thumb: 'https://example.com/thumbs/scalene.jpg' },
    { provider: providers[3], title: 'Isometric Jaw Press', desc: 'Strengthen jaw closing muscles with gentle resistance.', dur: 60, cat: 'Strengthening', inst: '1. Place folded gauze between back teeth\n2. Gently bite down and hold 5 seconds\n3. Release and rest 3 seconds\n4. Repeat 10 times per side', video: 'https://example.com/videos/iso-jaw.mp4', thumb: 'https://example.com/thumbs/iso-jaw.jpg' },
    { provider: providers[4], title: 'Shoulder Blade Squeeze', desc: 'Improve upper back posture to reduce strain on the jaw and neck.', dur: 45, cat: 'Posture', inst: '1. Sit or stand upright\n2. Pull shoulder blades together\n3. Hold 5 seconds\n4. Release\n5. Repeat 15 times', video: 'https://example.com/videos/shoulder-blade.mp4', thumb: 'https://example.com/thumbs/shoulder-blade.jpg' },
    { provider: providers[4], title: 'Heat Application Protocol', desc: 'Guided moist heat application to reduce muscle spasm.', dur: 900, cat: 'Modality', inst: '1. Wet a small towel with warm water\n2. Wring out excess\n3. Apply to jaw and temple area\n4. Hold 15 minutes\n5. Reheat every 5 minutes if needed', video: 'https://example.com/videos/heat-protocol.mp4', thumb: 'https://example.com/thumbs/heat-protocol.jpg' },
  ];

  const exerciseIds: string[] = [];
  for (const e of exerciseData) {
    const [row] = await db.insert(schema.exercises).values({
      provider_id: e.provider.id,
      title: e.title,
      description: e.desc,
      duration_seconds: e.dur,
      category: e.cat,
      instructions: e.inst,
      video_url: e.video,
      thumbnail_url: e.thumb,
    }).returning({ id: schema.exercises.id });
    exerciseIds.push(row.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 9. EXERCISE ASSIGNMENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding exercise assignments…');

  const assignments = [
    { exercise: exerciseIds[0],  patient: patients[0].id, provider: providers[0].id, freq: 'daily',      sets: 3, status: 'active'    as const, daysBack: 60 },
    { exercise: exerciseIds[1],  patient: patients[0].id, provider: providers[0].id, freq: 'daily',      sets: 2, status: 'active'    as const, daysBack: 60 },
    { exercise: exerciseIds[2],  patient: patients[1].id, provider: providers[0].id, freq: '3x weekly',  sets: 2, status: 'active'    as const, daysBack: 45 },
    { exercise: exerciseIds[3],  patient: patients[1].id, provider: providers[1].id, freq: 'daily',      sets: 1, status: 'active'    as const, daysBack: 45 },
    { exercise: exerciseIds[4],  patient: patients[2].id, provider: providers[1].id, freq: 'daily',      sets: 2, status: 'active'    as const, daysBack: 30 },
    { exercise: exerciseIds[5],  patient: patients[2].id, provider: providers[2].id, freq: 'daily',      sets: 3, status: 'active'    as const, daysBack: 50 },
    { exercise: exerciseIds[6],  patient: patients[4].id, provider: providers[2].id, freq: 'daily',      sets: 1, status: 'active'    as const, daysBack: 40 },
    { exercise: exerciseIds[7],  patient: patients[3].id, provider: providers[3].id, freq: '2x daily',   sets: 2, status: 'active'    as const, daysBack: 35 },
    { exercise: exerciseIds[8],  patient: patients[7].id, provider: providers[3].id, freq: 'daily',      sets: 3, status: 'active'    as const, daysBack: 55 },
    { exercise: exerciseIds[9],  patient: patients[4].id, provider: providers[4].id, freq: 'daily',      sets: 2, status: 'active'    as const, daysBack: 25 },
    { exercise: exerciseIds[10], patient: patients[7].id, provider: providers[4].id, freq: '3x weekly',  sets: 1, status: 'active'    as const, daysBack: 30 },
    { exercise: exerciseIds[0],  patient: patients[5].id, provider: providers[0].id, freq: 'daily',      sets: 2, status: 'active'    as const, daysBack: 20 },
    { exercise: exerciseIds[1],  patient: patients[6].id, provider: providers[1].id, freq: 'daily',      sets: 1, status: 'active'    as const, daysBack: 15 },
    // Paused and completed historical assignments.
    { exercise: exerciseIds[0],  patient: patients[3].id, provider: providers[0].id, freq: 'daily',      sets: 1, status: 'paused'    as const, daysBack: 80 },
    { exercise: exerciseIds[3],  patient: patients[0].id, provider: providers[0].id, freq: '3x weekly',  sets: 2, status: 'completed' as const, daysBack: 90 },
  ];

  const assignmentIds: string[] = [];
  for (const a of assignments) {
    const [row] = await db.insert(schema.exerciseAssignments).values({
      exercise_id: a.exercise,
      patient_id: a.patient,
      provider_id: a.provider,
      frequency: a.freq,
      sets: a.sets,
      status: a.status,
      assigned_at: daysAgo(a.daysBack),
    }).returning({ id: schema.exerciseAssignments.id });
    assignmentIds.push(row.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 10. EXERCISE COMPLETIONS (realistic gaps — ~75% adherence)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding exercise completions…');

  // Active assignments with history.
  const completionPairs = [
    { assignmentIdx: 0,  patientIdx: 0, days: 60 },
    { assignmentIdx: 1,  patientIdx: 0, days: 60 },
    { assignmentIdx: 2,  patientIdx: 1, days: 45 },
    { assignmentIdx: 3,  patientIdx: 1, days: 45 },
    { assignmentIdx: 4,  patientIdx: 2, days: 30 },
    { assignmentIdx: 5,  patientIdx: 2, days: 50 },
    { assignmentIdx: 6,  patientIdx: 4, days: 40 },
    { assignmentIdx: 7,  patientIdx: 3, days: 35 },
    { assignmentIdx: 8,  patientIdx: 7, days: 55 },
    { assignmentIdx: 9,  patientIdx: 4, days: 25 },
    { assignmentIdx: 10, patientIdx: 7, days: 30 },
    { assignmentIdx: 11, patientIdx: 5, days: 20 },
    { assignmentIdx: 12, patientIdx: 6, days: 15 },
  ];

  for (const cp of completionPairs) {
    for (let day = 0; day < cp.days; day++) {
      if (Math.random() < 0.75) { // 75% adherence.
        await db.insert(schema.exerciseCompletions).values({
          assignment_id: assignmentIds[cp.assignmentIdx],
          patient_id: patients[cp.patientIdx].id,
          completed_at: daysAgo(day),
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 11. SYMPTOM LOGS (90 days per patient)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding symptom logs (90 days × 8 patients)…');

  const painTypes = ['aching', 'sharp', 'throbbing', 'dull', 'shooting', 'burning', 'pressure'];
  const bodyAreas = [
    [{ area: 'jaw', side: 'left' }],
    [{ area: 'jaw', side: 'right' }],
    [{ area: 'jaw', side: 'both' }],
    [{ area: 'jaw', side: 'left' }, { area: 'temple', side: 'left' }],
    [{ area: 'jaw', side: 'both' }, { area: 'neck', side: 'both' }],
    [{ area: 'neck', side: 'both' }],
    [{ area: 'jaw', side: 'both' }, { area: 'ear', side: 'right' }],
    [{ area: 'temple', side: 'both' }, { area: 'jaw', side: 'both' }],
  ];
  const triggersList = ['chewing', 'stress', 'cold weather', 'yawning', 'clenching', 'sleeping', 'talking', 'wide opening'];
  const notesList = [
    'Pain has been improving with regular exercises.',
    'Woke up with jaw clenched again.',
    'Better day overall, minimal symptoms.',
    'Stress at work making symptoms worse.',
    'Hot pack helped this evening.',
    'Forgot to do exercises today — will catch up tomorrow.',
    'Clicking sound more noticeable than usual.',
    'Difficulty chewing harder foods today.',
    null, null, null, // Mostly no notes.
  ];

  // Pain trend: each patient has a slowly improving trend over 90 days.
  const patientBasePain = [6, 7, 8, 5, 6, 4, 7, 5]; // Starting pain level.
  for (let pi = 0; pi < patients.length; pi++) {
    for (let day = 0; day < 90; day++) {
      const logDate = daysAgo(day);
      const trend = (day / 90) * 2; // Gradual improvement of up to 2 points over 90 days.
      const pain = Math.max(0, Math.min(10, Math.round(
        patientBasePain[pi] - trend + (Math.random() - 0.5) * 3,
      )));
      await db.insert(schema.symptomLogs).values({
        patient_id: patients[pi].id,
        pain_level: pain,
        pain_types: [painTypes[randomInt(0, painTypes.length)], painTypes[randomInt(0, painTypes.length)]],
        body_areas: bodyAreas[randomInt(0, bodyAreas.length)],
        duration_minutes: randomInt(10, 240),
        triggers: [triggersList[randomInt(0, triggersList.length)], triggersList[randomInt(0, triggersList.length)]],
        notes: notesList[randomInt(0, notesList.length)],
        logged_at: logDate,
        created_at: logDate,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 12. JAW MOBILITY LOGS (90 days per patient)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding jaw mobility logs (90 days × 8 patients)…');

  const patientBaseMm = [28, 22, 18, 32, 25, 35, 20, 30]; // Starting mm opening.
  const methods = ['fingers', 'ruler', 'fingers', 'ruler']; // 'fingers' more common.
  for (let pi = 0; pi < patients.length; pi++) {
    for (let day = 0; day < 90; day++) {
      if (Math.random() < 0.65) { // Not every day — ~65% logging rate.
        const logDate = daysAgo(day);
        const improvement = (day / 90) * 6; // Up to 6mm improvement over 90 days.
        const mm = Math.max(10, Math.min(60, Math.round(
          patientBaseMm[pi] + improvement + (Math.random() - 0.5) * 4,
        )));
        await db.insert(schema.jawMobilityLogs).values({
          patient_id: patients[pi].id,
          measurement_mm: mm,
          method: methods[randomInt(0, methods.length)],
          notes: Math.random() > 0.8 ? 'Measured before morning exercises' : null,
          logged_at: logDate,
          created_at: logDate,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 13. SLEEP LOGS (90 days per patient)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding sleep logs (90 days × 8 patients)…');

  const sleepNotes = [
    'Woke up with tight jaw.',
    'Good night, minimal grinding.',
    'Night guard helped.',
    'Partner noted I was grinding.',
    'Stress before bed — jaw tension.',
    null, null, null,
  ];

  for (let pi = 0; pi < patients.length; pi++) {
    for (let day = 0; day < 90; day++) {
      if (Math.random() < 0.70) {
        const logDate = daysAgo(day);
        await db.insert(schema.sleepLogs).values({
          patient_id: patients[pi].id,
          quality: randomInt(1, 6),
          hours_slept: String((5 + Math.random() * 4).toFixed(1)),
          bruxism_aware: Math.random() < 0.35,
          morning_stiffness: randomInt(0, 11),
          notes: sleepNotes[randomInt(0, sleepNotes.length)],
          logged_at: logDate,
          created_at: logDate,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 14. MEDICATION LOGS (90 days per patient)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding medication logs…');

  const patientMeds = [
    [{ name: 'Ibuprofen 400mg', dosage: '400mg', notes: 'Taken with food' }, { name: 'Magnesium Glycinate', dosage: '400mg', notes: 'Before bed for muscle relaxation' }],
    [{ name: 'Naproxen 500mg', dosage: '500mg', notes: 'Twice daily with meals' }, { name: 'Cyclobenzaprine', dosage: '5mg', notes: 'At bedtime only' }],
    [{ name: 'Meloxicam', dosage: '15mg', notes: 'Once daily in the morning' }, { name: 'Amitriptyline', dosage: '10mg', notes: 'For sleep and pain modulation' }],
    [{ name: 'Ibuprofen 600mg', dosage: '600mg', notes: 'As needed for pain' }],
    [{ name: 'Diclofenac Gel', dosage: '1% applied topically', notes: 'Over jaw joint 3x daily' }, { name: 'Baclofen', dosage: '10mg', notes: 'For muscle spasm' }],
    [{ name: 'Acetaminophen 500mg', dosage: '500mg', notes: 'As needed, max 3g/day' }],
    [{ name: 'Naproxen 250mg', dosage: '250mg', notes: 'As needed for flares' }],
    [{ name: 'Gabapentin', dosage: '300mg', notes: 'For nerve pain component' }, { name: 'Melatonin', dosage: '5mg', notes: 'For sleep onset' }],
  ];

  for (let pi = 0; pi < patients.length; pi++) {
    for (let day = 0; day < 90; day++) {
      for (const med of patientMeds[pi]) {
        if (Math.random() < 0.6) {
          const logDate = daysAgo(day);
          await db.insert(schema.medicationLogs).values({
            patient_id: patients[pi].id,
            medication_name: med.name,
            dosage: med.dosage,
            notes: med.notes,
            logged_at: logDate,
            created_at: logDate,
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 15. REPORTS (8 weeks of weekly reports + some urgent)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding reports…');

  const reportDefs = [
    // Alice's 8 weekly reports to Dr. Smith.
    { patient: patients[0], provider: providers[0], urgency: 'routine' as const, pain: 6, desc: 'Week 1: Significant jaw pain after dental cleaning. Exercises helping slightly.', status: 'responded' as const, daysBack: 56, flagged: false },
    { patient: patients[0], provider: providers[0], urgency: 'routine' as const, pain: 5, desc: 'Week 2: Pain starting to decrease. Lateral jaw stretches very helpful.', status: 'responded' as const, daysBack: 49, flagged: false },
    { patient: patients[0], provider: providers[0], urgency: 'routine' as const, pain: 5, desc: 'Week 3: Managed well this week. Stressful work week but exercises kept pain down.', status: 'reviewed' as const, daysBack: 42, flagged: false },
    { patient: patients[0], provider: providers[0], urgency: 'concerning' as const, pain: 7, desc: 'Week 4: Flare after chewing hard food. Ice packs helping. Sleeping poorly.', status: 'responded' as const, daysBack: 35, flagged: true },
    { patient: patients[0], provider: providers[0], urgency: 'routine' as const, pain: 4, desc: 'Week 5: Significant improvement after adjusting diet to softer foods.', status: 'reviewed' as const, daysBack: 28, flagged: false },
    { patient: patients[0], provider: providers[0], urgency: 'routine' as const, pain: 4, desc: 'Week 6: Consistent improvement. Opening 34mm measured this week.', status: 'reviewed' as const, daysBack: 21, flagged: false },
    { patient: patients[0], provider: providers[0], urgency: 'routine' as const, pain: 3, desc: 'Week 7: Best week so far. Pain well controlled with exercises.', status: 'responded' as const, daysBack: 14, flagged: false },
    { patient: patients[0], provider: providers[0], urgency: 'routine' as const, pain: 3, desc: 'Week 8: Continuing to improve. Planning to return to normal diet cautiously.', status: 'submitted' as const, daysBack: 0, flagged: false },
    // Bob — concerning and urgent reports.
    { patient: patients[1], provider: providers[0], urgency: 'concerning' as const, pain: 7, desc: 'Pain increased significantly after dental work last week. Difficulty opening mouth fully.', status: 'responded' as const, daysBack: 21, flagged: false },
    { patient: patients[1], provider: providers[1], urgency: 'urgent' as const, pain: 9, desc: 'Acute locking episode yesterday — could not open mouth beyond 10mm. Went to ER.', status: 'responded' as const, daysBack: 14, flagged: true },
    { patient: patients[1], provider: providers[0], urgency: 'routine' as const, pain: 5, desc: 'Post-acute recovery. Mouth opening back to 28mm. Soft diet maintained.', status: 'submitted' as const, daysBack: 0, flagged: false },
    // Carol — urgent and severe.
    { patient: patients[2], provider: providers[1], urgency: 'urgent' as const, pain: 9, desc: 'Severe pain episode. Unable to eat solid food for 3 days. Clicking has worsened markedly.', status: 'responded' as const, daysBack: 7, flagged: true },
    { patient: patients[2], provider: providers[2], urgency: 'routine' as const, pain: 5, desc: 'Tongue exercises improving coordination. Neck tension reduced with PT.', status: 'submitted' as const, daysBack: 0, flagged: false },
    // Dave.
    { patient: patients[3], provider: providers[0], urgency: 'routine' as const, pain: 3, desc: 'Minimal symptoms this week. Stress management and exercises both helping.', status: 'reviewed' as const, daysBack: 14, flagged: false },
    { patient: patients[3], provider: providers[3], urgency: 'routine' as const, pain: 4, desc: 'Some improvement with scalene stretches. Headaches reduced by 50%.', status: 'submitted' as const, daysBack: 0, flagged: false },
    // Eva.
    { patient: patients[4], provider: providers[2], urgency: 'concerning' as const, pain: 6, desc: 'Jaw locking episodes twice this week. Breathing exercises help reduce tension post-episode.', status: 'reviewed' as const, daysBack: 14, flagged: false },
    { patient: patients[4], provider: providers[4], urgency: 'routine' as const, pain: 5, desc: 'OT exercises for posture helping overall. Less shoulder tension feeding into jaw.', status: 'submitted' as const, daysBack: 0, flagged: false },
    // Frank.
    { patient: patients[5], provider: providers[0], urgency: 'routine' as const, pain: 4, desc: 'Arthritis flare managed with increased NSAID dose per GP recommendation. Exercises maintained.', status: 'reviewed' as const, daysBack: 7, flagged: false },
    // Grace.
    { patient: patients[6], provider: providers[1], urgency: 'concerning' as const, pain: 6, desc: 'JIA flare this week — jaw very stiff in mornings. Using heat before exercises.', status: 'responded' as const, daysBack: 7, flagged: false },
    // Henry.
    { patient: patients[7], provider: providers[3], urgency: 'routine' as const, pain: 5, desc: 'Daily headaches reduced to 3 days this week. Jaw exercises contributing positively.', status: 'reviewed' as const, daysBack: 7, flagged: false },
    { patient: patients[7], provider: providers[4], urgency: 'routine' as const, pain: 4, desc: 'Ergonomic workstation adjustments made. Jaw tension noticeably less at end of day.', status: 'submitted' as const, daysBack: 0, flagged: false },
  ];

  const reportIds: string[] = [];
  for (const r of reportDefs) {
    const submitted = daysAgo(r.daysBack);
    const [row] = await db.insert(schema.reports).values({
      patient_id: r.patient.id,
      provider_id: r.provider.id,
      urgency: r.urgency,
      pain_level: r.pain,
      description: r.desc,
      photo_url: Math.random() > 0.7 ? 'https://example.com/photos/report-placeholder.jpg' : null,
      patient_notes: Math.random() > 0.5 ? 'Tried to follow treatment plan as closely as possible.' : null,
      status: r.status,
      flagged: r.flagged,
      summary_data: { avg_pain: r.pain, exercises_completed: randomInt(5, 21), days_logged: randomInt(5, 7) },
      period_start: new Date(submitted.getTime() - 7 * 24 * 60 * 60 * 1000),
      period_end: submitted,
      submitted_at: submitted,
      authored_by_user_id: r.patient.id,
      authored_by_role: 'patient',
      viewed_at: r.status !== 'submitted' ? new Date(submitted.getTime() + 2 * 60 * 60 * 1000) : null,
      reviewed_at: r.status === 'reviewed' || r.status === 'responded' ? new Date(submitted.getTime() + 4 * 60 * 60 * 1000) : null,
    }).returning({ id: schema.reports.id });
    reportIds.push(row.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 16. REPORT RESPONSES
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding report responses…');

  await db.insert(schema.reportResponses).values([
    { report_id: reportIds[0], provider_id: providers[0].id, message: 'Good start Alice. Post-cleaning sensitivity is normal. Keep up the jaw stretches daily and ice after exercises if tender.', internal_notes: 'Post-prophylaxis flare. Normal presentation. Continue current plan.', responded_at: daysAgo(55) },
    { report_id: reportIds[1], provider_id: providers[0].id, message: 'Great improvement! The lateral stretches are clearly working. Continue daily and add the chin tuck.', internal_notes: 'Responding well to home exercise program. Add exercise #2.', responded_at: daysAgo(48) },
    { report_id: reportIds[3], provider_id: providers[0].id, message: 'Sorry to hear about the flare. For the next 48h: soft diet only, ice 15 min on/off, no wide yawning. If swelling or severe pain continues, call the office.', internal_notes: 'Dietary trigger — hard food. Educate re: diet. Monitor for prolonged flare.', responded_at: daysAgo(34) },
    { report_id: reportIds[6], provider_id: providers[0].id, message: 'This is your best report yet! Opening 34mm is solid progress. Keep the current routine.', internal_notes: 'Excellent objective improvement. Continue conservative management.', responded_at: daysAgo(13) },
    { report_id: reportIds[8], provider_id: providers[0].id, message: 'Post-procedure pain is expected. Soft foods for at least 5 days, ice packs every 2–3 hours when awake. Let me know if locking recurs.', internal_notes: 'Post-dental manipulation flare. Refer back to oral surgeon if locking recurs.', responded_at: daysAgo(20) },
    { report_id: reportIds[9], provider_id: providers[1].id, message: 'Bob, an ER visit was the right call. Acute closed lock is serious. We need to see you ASAP — please call the office first thing. Soft diet and no wide opening until then.', internal_notes: 'Acute closed lock — disc displacement w/o reduction. Priority appointment. Consider MRI/arthrocentesis.', responded_at: daysAgo(13) },
    { report_id: reportIds[11], provider_id: providers[1].id, message: 'Carol, I am very concerned about this severity. Please come in for an emergency evaluation. In the meantime: liquid diet, ice packs, and take your NSAID as prescribed.', internal_notes: 'Suspect disc displacement without reduction. Urgent MRI. Flagged for priority.', responded_at: hoursAgo(48) },
    { report_id: reportIds[13], provider_id: providers[0].id, message: 'Excellent Dave — keep up the good work. The stress management component is really paying off.', internal_notes: 'Good progress. No changes to plan.', responded_at: daysAgo(13) },
    { report_id: reportIds[15], provider_id: providers[2].id, message: 'Eva, locking twice a week needs attention. Try the relaxation breathing exercise immediately after you feel the prodrome. I am sending a referral to the oral surgeon.', internal_notes: 'Increasing locking frequency. Refer OS. Consider splint therapy.', responded_at: daysAgo(13) },
    { report_id: reportIds[18], provider_id: providers[1].id, message: 'Grace, morning stiffness with JIA is expected in a flare. Continue heat before exercises, and reduce intensity if pain is above 7. Contact your rheumatologist about the systemic flare.', internal_notes: 'JIA flare — coordinate with rheumatology. Reduce exercise intensity temporarily.', responded_at: daysAgo(6) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 17. CLINICAL NOTES (provider notes about patients — never visible to patient)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding clinical notes…');

  const clinicalNoteDefs = [
    { patient: patients[0], provider: providers[0], body: 'Initial evaluation 3 months ago. Disc displacement with reduction confirmed on clinical exam. TMJ loading test positive bilaterally. Patient reports bruxism since childhood. Night guard ordered from lab.', tags: ['initial-eval', 'disc-displacement', 'bruxism'], daysBack: 90 },
    { patient: patients[0], provider: providers[0], body: '6-week follow-up. Mouth opening improved from 28mm to 34mm. Clicking reduced. Night guard compliance good. Continue HEP.', tags: ['follow-up', 'improvement'], daysBack: 48 },
    { patient: patients[0], provider: providers[4], body: 'Postural assessment: significant forward head posture (2-inch anterior shift). Upper crossed syndrome pattern. Recommend shoulder blade squeeze and chin tuck daily.', tags: ['posture', 'upper-crossed-syndrome'], daysBack: 30 },
    { patient: patients[1], provider: providers[0], body: 'Post-dental work flare. Patient reports dental cleaning precipitated acute pain episode. Common trigger. Educated on jaw rest protocol post-dental procedures.', tags: ['flare', 'dental-trigger', 'education'], daysBack: 21 },
    { patient: patients[1], provider: providers[1], body: 'Acute closed lock — disc displacement w/o reduction. Unable to open beyond 10mm on exam. Arthrocentesis performed with immediate improvement to 32mm. Patient instructed to avoid wide opening for 2 weeks.', tags: ['closed-lock', 'arthrocentesis', 'acute'], daysBack: 14 },
    { patient: patients[2], provider: providers[1], body: 'MRI results reviewed. Left TMJ: posterior disc displacement without reduction, perforation suspected. Right TMJ: disc displacement with reduction. Surgical consult recommended for left TMJ.', tags: ['mri', 'disc-perforation', 'surgical-consult'], daysBack: 7 },
    { patient: patients[2], provider: providers[2], body: 'Significant cervical involvement: C1-C2 restriction, hypertonic SCM and scalenes bilaterally. Cervical dysfunction appears to be perpetuating TMJ pain. Three sessions of manual therapy recommended.', tags: ['cervical', 'manual-therapy', 'SCM'], daysBack: 21 },
    { patient: patients[3], provider: providers[3], body: 'Craniofacial pain assessment. Mixed myogenous-arthrogenous presentation. Tension-type headaches co-morbid. Recommended referral to psychology for CBT/biofeedback for stress component.', tags: ['mixed-disorder', 'headache', 'psychology-referral'], daysBack: 35 },
    { patient: patients[4], provider: providers[2], body: 'Fibromyalgia confirmed (primary diagnosis from rheumatology). TMJ involvement is part of broader central sensitization. Exercise intensity should be low and progressive. Monitor for post-exertional malaise.', tags: ['fibromyalgia', 'central-sensitization', 'pacing'], daysBack: 40 },
    { patient: patients[5], provider: providers[0], body: 'Radiographs show significant subchondral sclerosis and flattening of bilateral condylar heads consistent with TMJ OA. Patient age 45, male. Conservative management appropriate. No surgical indication at this time.', tags: ['osteoarthritis', 'radiograph', 'conservative-management'], daysBack: 20 },
    { patient: patients[6], provider: providers[1], body: 'Juvenile patient with confirmed JIA. TMJ involvement is common in JIA (~50%). Coordination with Dr. Patel (rheumatology) and pediatric dentist ongoing. Growth disruption monitoring essential. Low-force appliance therapy started.', tags: ['JIA', 'juvenile', 'multidisciplinary', 'appliance'], daysBack: 15 },
    { patient: patients[7], provider: providers[3], body: 'Chronic daily headache — TMJ etiology confirmed. CPT/MRI negative for intracranial cause. Botox injections to masseter and temporalis muscles discussed as next step if exercises insufficient over 8 weeks.', tags: ['chronic-headache', 'botox-candidate', 'masseter'], daysBack: 55 },
    { patient: patients[7], provider: providers[4], body: 'Ergonomic evaluation performed at workplace (photos reviewed). Monitor is too low causing forward head. Keyboard height requires raising. Recommend 20-20-20 rule for screen breaks. Posture-related jaw clenching very likely.', tags: ['ergonomics', 'posture', 'occupational'], daysBack: 30 },
  ];

  for (const n of clinicalNoteDefs) {
    await db.insert(schema.clinicalNotes).values({
      patient_id: n.patient.id,
      provider_id: n.provider.id,
      body: n.body,
      tags: n.tags,
      created_at: daysAgo(n.daysBack),
      updated_at: daysAgo(n.daysBack),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 18. CLINIC VISITS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding clinic visits…');

  const clinicVisitDefs = [
    { patient: patients[0], provider: providers[0], notes: 'Initial evaluation. Clinical exam, radiographs. Night guard impressions taken.', daysBack: 90 },
    { patient: patients[0], provider: providers[0], notes: '6-week follow-up. Good progress. Adjusted home exercise program.', daysBack: 48 },
    { patient: patients[0], provider: providers[4], notes: 'Postural assessment and ergonomic review. OT home program issued.', daysBack: 30 },
    { patient: patients[1], provider: providers[0], notes: 'Urgent visit post-dental work. Jaw rest protocol reviewed. NSAIDs prescribed.', daysBack: 21 },
    { patient: patients[1], provider: providers[1], notes: 'Emergency arthrocentesis for acute closed lock. Procedure well tolerated. Post-op instructions given.', daysBack: 14 },
    { patient: patients[2], provider: providers[1], notes: 'MRI review appointment. Surgical referral discussed. Patient very anxious.', daysBack: 7 },
    { patient: patients[2], provider: providers[2], notes: 'Initial PT assessment. Joint mobilization grade II. HEP issued.', daysBack: 21 },
    { patient: patients[2], provider: providers[2], notes: 'PT session 2. Grade III mobilization. Significant improvement in ROM.', daysBack: 14 },
    { patient: patients[3], provider: providers[3], notes: 'New patient evaluation. Complete craniofacial pain assessment. Psychology referral given.', daysBack: 35 },
    { patient: patients[4], provider: providers[2], notes: 'Initial assessment. Fibromyalgia briefing, pacing principles discussed. Low-intensity HEP.', daysBack: 40 },
    { patient: patients[4], provider: providers[2], notes: 'Follow-up PT. Mild improvement. Intensity cautiously increased.', daysBack: 20 },
    { patient: patients[5], provider: providers[0], notes: 'Annual review. Radiographs taken. OA progression stable. Continue conservative management.', daysBack: 20 },
    { patient: patients[6], provider: providers[1], notes: 'New patient — JIA with TMJ. Full exam, impressions for appliance. Rheumatology letter sent.', daysBack: 15 },
    { patient: patients[7], provider: providers[3], notes: 'Initial evaluation for chronic daily headache. TMJ as primary etiology confirmed. Botox discussed.', daysBack: 55 },
    { patient: patients[7], provider: providers[4], notes: 'Workplace ergonomic review via telehealth. Adjustments recommended. Follow-up in 4 weeks.', daysBack: 30 },
  ];

  for (const v of clinicVisitDefs) {
    await db.insert(schema.clinicVisits).values({
      patient_id: v.patient.id,
      provider_id: v.provider.id,
      visited_at: daysAgo(v.daysBack),
      notes: v.notes,
      created_at: daysAgo(v.daysBack),
      updated_at: daysAgo(v.daysBack),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 19. REPORT REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding report requests…');

  const [rr1] = await db.insert(schema.reportRequests).values({
    provider_id: providers[0].id,
    patient_id: patients[0].id,
    prompt: 'Hi Alice — it has been 7 days since your last report. Please submit your weekly update including mouth opening measurement if possible.',
    status: 'fulfilled',
    fulfilled_report_id: reportIds[7],
    fulfilled_at: daysAgo(0),
    created_at: daysAgo(2),
  }).returning({ id: schema.reportRequests.id });

  await db.insert(schema.reportRequests).values([
    { provider_id: providers[1].id, patient_id: patients[1].id, prompt: 'Bob, following your arthrocentesis last week, please submit a detailed symptom report so I can assess your recovery.', status: 'fulfilled', fulfilled_report_id: reportIds[10], fulfilled_at: daysAgo(0), created_at: daysAgo(3) },
    { provider_id: providers[2].id, patient_id: patients[4].id, prompt: 'Eva, I would like a report on the jaw locking frequency this week before our next appointment. Please note any triggers you identified.', status: 'pending', created_at: daysAgo(1) },
    { provider_id: providers[3].id, patient_id: patients[7].id, prompt: 'Henry, please report on your headache frequency and the impact of the new ergonomic setup.', status: 'pending', created_at: daysAgo(2) },
    { provider_id: providers[0].id, patient_id: patients[3].id, prompt: 'Dave, can you submit a report on your progress with the stress management exercises? It has been 2 weeks.', status: 'dismissed', dismissed_at: daysAgo(1), created_at: daysAgo(5) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 20. INTAKE FORMS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding intake forms…');

  const [form1] = await db.insert(schema.intakeForms).values({
    provider_id: providers[0].id,
    title: 'New Patient TMJ Intake Questionnaire',
    description: 'Please complete this form before your first appointment. It helps us understand your TMJ history and current symptoms.',
    status: 'published',
    fields: [
      { id: 'q1', type: 'text',     label: 'When did you first notice jaw pain or clicking?', required: true },
      { id: 'q2', type: 'select',   label: 'What best describes your main symptom?', required: true, options: ['Jaw pain', 'Jaw clicking/popping', 'Limited opening', 'Headaches', 'Ear pain', 'Multiple symptoms'] },
      { id: 'q3', type: 'scale',    label: 'On average, rate your jaw pain this week (0–10)', required: true, min: 0, max: 10 },
      { id: 'q4', type: 'checkbox', label: 'Do you experience any of the following?', required: false, options: ['Bruxism (teeth grinding)', 'Jaw locking', 'Difficulty chewing', 'Neck pain', 'Tinnitus (ringing in ears)', 'Dizziness'] },
      { id: 'q5', type: 'textarea', label: 'Describe any previous treatments you have had for jaw pain', required: false },
      { id: 'q6', type: 'select',   label: 'How much does jaw pain affect your daily activities?', required: true, options: ['Not at all', 'Slightly', 'Moderately', 'Significantly', 'Severely'] },
    ],
  }).returning({ id: schema.intakeForms.id });

  const [form2] = await db.insert(schema.intakeForms).values({
    provider_id: providers[1].id,
    title: 'Pre-Procedure Surgical Evaluation Form',
    description: 'Required for all patients scheduled for arthrocentesis or arthroscopy.',
    status: 'published',
    fields: [
      { id: 'q1', type: 'select',   label: 'Have you had any previous TMJ surgeries?', required: true, options: ['No', 'Arthrocentesis', 'Arthroscopy', 'Open joint surgery', 'Multiple procedures'] },
      { id: 'q2', type: 'checkbox', label: 'List any blood-thinning medications (check all that apply)', required: true, options: ['Aspirin', 'Warfarin', 'Clopidogrel', 'Apixaban', 'None of the above'] },
      { id: 'q3', type: 'text',     label: 'Do you have any allergies to local anaesthetics? If yes, list them', required: true },
      { id: 'q4', type: 'scale',    label: 'Rate your current mouth opening limitation (0 = none, 10 = cannot open at all)', required: true, min: 0, max: 10 },
      { id: 'q5', type: 'textarea', label: 'Additional notes or concerns about the planned procedure', required: false },
    ],
  }).returning({ id: schema.intakeForms.id });

  const [form3] = await db.insert(schema.intakeForms).values({
    provider_id: providers[2].id,
    title: 'Physical Therapy Initial Assessment Form',
    description: 'Helps us tailor your PT program to your specific needs and limitations.',
    status: 'published',
    fields: [
      { id: 'q1', type: 'text',     label: 'What activities are most limited by your jaw/neck pain?', required: true },
      { id: 'q2', type: 'scale',    label: 'Rate your worst pain in the last 7 days (0–10)', required: true, min: 0, max: 10 },
      { id: 'q3', type: 'scale',    label: 'Rate your average pain in the last 7 days (0–10)', required: true, min: 0, max: 10 },
      { id: 'q4', type: 'checkbox', label: 'Which of the following aggravate your symptoms?', required: false, options: ['Sustained postures', 'Chewing', 'Stress', 'Cold/wind', 'Exercise', 'Computer work'] },
      { id: 'q5', type: 'textarea', label: 'Describe your current exercise routine (if any)', required: false },
      { id: 'q6', type: 'select',   label: 'How would you rate your overall physical fitness level?', required: true, options: ['Sedentary', 'Lightly active', 'Moderately active', 'Very active'] },
    ],
  }).returning({ id: schema.intakeForms.id });

  // Draft form (not yet assigned).
  await db.insert(schema.intakeForms).values({
    provider_id: providers[3].id,
    title: 'Craniofacial Pain Outcomes Questionnaire (Draft)',
    description: 'Work in progress — not yet published.',
    status: 'draft',
    fields: [
      { id: 'q1', type: 'text', label: 'Placeholder question', required: true },
    ],
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 21. INTAKE FORM ASSIGNMENTS + RESPONSES
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding intake form assignments and responses…');

  // Alice — completed form 1.
  const [ia1] = await db.insert(schema.intakeFormAssignments).values({
    form_id: form1.id, patient_id: patients[0].id, provider_id: providers[0].id,
    status: 'completed', assigned_at: daysAgo(92), completed_at: daysAgo(91),
  }).returning({ id: schema.intakeFormAssignments.id });

  await db.insert(schema.intakeResponses).values({
    assignment_id: ia1.id, form_id: form1.id, patient_id: patients[0].id,
    answers: [
      { id: 'q1', value: 'About 2 years ago after a car accident — started with clicking then pain.' },
      { id: 'q2', value: 'Multiple symptoms' },
      { id: 'q3', value: 6 },
      { id: 'q4', value: ['Bruxism (teeth grinding)', 'Neck pain'] },
      { id: 'q5', value: 'Tried a night guard from my dentist 1 year ago but stopped wearing it.' },
      { id: 'q6', value: 'Significantly' },
    ],
    submitted_at: daysAgo(91),
  });

  // Bob — completed forms 1 and 2 (pre-surgical).
  const [ia2] = await db.insert(schema.intakeFormAssignments).values({
    form_id: form1.id, patient_id: patients[1].id, provider_id: providers[0].id,
    status: 'completed', assigned_at: daysAgo(50), completed_at: daysAgo(49),
  }).returning({ id: schema.intakeFormAssignments.id });

  await db.insert(schema.intakeResponses).values({
    assignment_id: ia2.id, form_id: form1.id, patient_id: patients[1].id,
    answers: [
      { id: 'q1', value: 'About 5 years ago — woke up one morning unable to fully open my mouth.' },
      { id: 'q2', value: 'Limited opening' },
      { id: 'q3', value: 7 },
      { id: 'q4', value: ['Jaw locking', 'Difficulty chewing', 'Tinnitus (ringing in ears)'] },
      { id: 'q5', value: 'Had a splint for 18 months, helped partially. Seen 2 other TMJ specialists.' },
      { id: 'q6', value: 'Severely' },
    ],
    submitted_at: daysAgo(49),
  });

  const [ia3] = await db.insert(schema.intakeFormAssignments).values({
    form_id: form2.id, patient_id: patients[1].id, provider_id: providers[1].id,
    status: 'completed', assigned_at: daysAgo(16), completed_at: daysAgo(15),
  }).returning({ id: schema.intakeFormAssignments.id });

  await db.insert(schema.intakeResponses).values({
    assignment_id: ia3.id, form_id: form2.id, patient_id: patients[1].id,
    answers: [
      { id: 'q1', value: 'No' },
      { id: 'q2', value: ['None of the above'] },
      { id: 'q3', value: 'No known anaesthetic allergies.' },
      { id: 'q4', value: 8 },
      { id: 'q5', value: 'Very nervous about the procedure. Please explain steps beforehand.' },
    ],
    submitted_at: daysAgo(15),
  });

  // Carol — completed form 3.
  const [ia4] = await db.insert(schema.intakeFormAssignments).values({
    form_id: form3.id, patient_id: patients[2].id, provider_id: providers[2].id,
    status: 'completed', assigned_at: daysAgo(22), completed_at: daysAgo(21),
  }).returning({ id: schema.intakeFormAssignments.id });

  await db.insert(schema.intakeResponses).values({
    assignment_id: ia4.id, form_id: form3.id, patient_id: patients[2].id,
    answers: [
      { id: 'q1', value: 'Eating, talking for extended periods, and sleeping on my side.' },
      { id: 'q2', value: 9 },
      { id: 'q3', value: 6 },
      { id: 'q4', value: ['Chewing', 'Stress', 'Computer work'] },
      { id: 'q5', value: 'I try to walk 30 minutes daily but jaw pain limits more vigorous activity.' },
      { id: 'q6', value: 'Lightly active' },
    ],
    submitted_at: daysAgo(21),
  });

  // Frank — pending form 1.
  await db.insert(schema.intakeFormAssignments).values({
    form_id: form1.id, patient_id: patients[5].id, provider_id: providers[0].id,
    status: 'pending', assigned_at: daysAgo(3),
  });

  // Grace — pending form 2.
  await db.insert(schema.intakeFormAssignments).values({
    form_id: form2.id, patient_id: patients[6].id, provider_id: providers[1].id,
    status: 'pending', assigned_at: daysAgo(5),
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 22. NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding notifications…');

  const notificationDefs = [
    { user: patients[0].id, type: 'exercise_reminder', title: 'Time for your exercises', body: 'You have 2 exercises to complete today. Keep up the great work!', read: true, hoursBack: 25 },
    { user: patients[0].id, type: 'report_reviewed', title: 'Report reviewed by Dr. Smith', body: 'Dr. Smith has reviewed your weekly report and left a response.', read: true, hoursBack: 13 },
    { user: patients[0].id, type: 'exercise_reminder', title: 'Time for your exercises', body: 'You have 2 exercises to complete today.', read: false, hoursBack: 1 },
    { user: patients[1].id, type: 'provider_message', title: 'Message from Dr. Smith', body: 'Post-procedure pain is expected. Soft foods for 5 days, ice packs every 2–3 hours.', read: false, hoursBack: 20, data: { reportId: reportIds[10] } },
    { user: patients[1].id, type: 'provider_message', title: 'Urgent message from Dr. Jones', body: 'Bob, an ER visit was the right call. Please call the office first thing tomorrow.', read: false, hoursBack: 13, data: { reportId: reportIds[9] } },
    { user: patients[2].id, type: 'provider_message', title: 'Urgent: Dr. Jones responded', body: 'Carol, I am very concerned. Please come in for an emergency evaluation.', read: true, hoursBack: 48 },
    { user: patients[2].id, type: 'exercise_assigned', title: 'New exercise assigned', body: 'Dr. Chen has assigned you a Tongue Up Exercise program.', read: true, hoursBack: 500 },
    { user: patients[3].id, type: 'report_request', title: 'Dr. Patel requests a report', body: 'Dr. Patel has asked you to submit a symptom report. Please complete when you can.', read: false, hoursBack: 48 },
    { user: patients[4].id, type: 'symptom_checkin', title: 'Daily check-in reminder', body: 'How are you feeling today? Log your symptoms to help track your progress.', read: false, hoursBack: 2 },
    { user: patients[5].id, type: 'intake_form', title: 'Please complete your intake form', body: 'Dr. Smith has sent you a new patient questionnaire. Please complete before your appointment.', read: false, hoursBack: 72 },
    { user: patients[6].id, type: 'intake_form', title: 'Pre-surgical form required', body: 'Dr. Jones has sent a pre-procedure form that must be completed before your next visit.', read: false, hoursBack: 120 },
    { user: patients[7].id, type: 'report_reviewed', title: 'Report reviewed by Dr. Patel', body: 'Your latest report has been reviewed. New exercise assignment added.', read: true, hoursBack: 7 },
    { user: providers[0].id, type: 'report_submitted', title: 'New report from Alice Johnson', body: 'Alice submitted a routine weekly check-in (Pain: 3/10).', read: true, hoursBack: 2, data: { reportId: reportIds[7] } },
    { user: providers[0].id, type: 'report_urgent', title: 'Concerning report from Bob Williams', body: 'Bob reported increased pain (7/10) following dental work.', read: false, hoursBack: 500, data: { reportId: reportIds[8] } },
    { user: providers[1].id, type: 'report_submitted', title: 'Urgent report from Carol Davis', body: 'Carol reported severe pain episode (9/10) — flagged as urgent.', read: true, hoursBack: 168, data: { reportId: reportIds[11] } },
    { user: providers[2].id, type: 'report_submitted', title: 'New report from Eva Brown', body: 'Eva submitted a concerning weekly report about locking episodes.', read: false, hoursBack: 336, data: { reportId: reportIds[15] } },
    { user: admins[0].id, type: 'system_alert', title: 'Urgent reports require attention', body: '3 urgent/flagged reports are awaiting provider response.', read: false, hoursBack: 1 },
  ];

  for (const n of notificationDefs) {
    await db.insert(schema.notifications).values({
      user_id: n.user,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data ?? {},
      read: n.read,
      read_at: n.read ? hoursAgo(Math.max(1, (n.hoursBack ?? 1) - 1)) : null,
      created_at: hoursAgo(n.hoursBack ?? 1),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 23. NOTIFICATION OUTBOX (email/SMS/push delivery records)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding notification outbox…');

  await db.insert(schema.notificationOutbox).values([
    { user_id: patients[0].id, channel: 'email', type: 'report_reviewed', payload: { to: patients[0].email, subject: 'Dr. Smith reviewed your report', body: 'Dr. Smith has left a response on your latest weekly report.' }, attempts: 1, max_attempts: 5, next_attempt_at: daysAgo(13), sent_at: daysAgo(13) },
    { user_id: patients[0].id, channel: 'push',  type: 'exercise_reminder', payload: { fcm_token: 'fcm-patient-1', title: 'Exercise time!', body: 'Your 2 exercises are ready.' }, attempts: 1, max_attempts: 5, next_attempt_at: hoursAgo(1), sent_at: hoursAgo(1) },
    { user_id: patients[1].id, channel: 'sms',   type: 'provider_message', payload: { to: patients[1].email, message: 'Dr. Jones has sent you an urgent message. Log in to view.' }, attempts: 1, max_attempts: 5, next_attempt_at: daysAgo(13), sent_at: daysAgo(13) },
    { user_id: patients[2].id, channel: 'push',  type: 'provider_message', payload: { fcm_token: 'fcm-patient-3', title: 'Urgent message from Dr. Jones', body: 'Please check your TMJConnect app.' }, attempts: 1, max_attempts: 5, next_attempt_at: hoursAgo(48), sent_at: hoursAgo(48) },
    { user_id: patients[2].id, channel: 'email', type: 'provider_message', payload: { to: patients[2].email, subject: 'Urgent message from Dr. Jones', body: 'Carol, please log in immediately to view an urgent message.' }, attempts: 1, max_attempts: 5, next_attempt_at: hoursAgo(48), sent_at: hoursAgo(48) },
    // Pending (not yet sent).
    { user_id: patients[5].id, channel: 'email', type: 'intake_form', payload: { to: patients[5].email, subject: 'Please complete your intake form', body: 'Dr. Smith has sent you a form to complete.' }, attempts: 0, max_attempts: 5, next_attempt_at: hoursAgo(1), sent_at: null },
    { user_id: patients[6].id, channel: 'push',  type: 'intake_form', payload: { fcm_token: 'fcm-patient-7', title: 'Intake form required', body: 'Please complete your pre-procedure form.' }, attempts: 0, max_attempts: 5, next_attempt_at: hoursAgo(5), sent_at: null },
    // Failed (exhausted retries).
    { user_id: patients[7].id, channel: 'push', type: 'exercise_reminder', payload: { fcm_token: 'fcm-patient-8-expired', title: 'Exercise time', body: 'Your exercises are ready.' }, attempts: 5, max_attempts: 5, next_attempt_at: daysAgo(1), sent_at: null, last_error: 'FCM token expired — InvalidRegistration' },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 24. REMINDERS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding reminders…');

  await db.insert(schema.reminders).values([
    { user_id: patients[0].id, type: 'exercise', time: '09:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'],              enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[0].id, type: 'symptom',  time: '20:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[1].id, type: 'exercise', time: '08:00', days: ['mon', 'wed', 'fri'],                              enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[1].id, type: 'symptom',  time: '21:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[2].id, type: 'exercise', time: '10:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'],              enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[2].id, type: 'symptom',  time: '21:30', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[3].id, type: 'exercise', time: '07:30', days: ['mon', 'tue', 'wed', 'thu', 'fri'],              enabled: false },
    { user_id: patients[3].id, type: 'symptom',  time: '19:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[4].id, type: 'exercise', time: '09:30', days: ['mon', 'tue', 'wed', 'thu', 'fri'],              enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[5].id, type: 'exercise', time: '08:30', days: ['mon', 'wed', 'fri'],                              enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[6].id, type: 'exercise', time: '16:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'],              enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[7].id, type: 'exercise', time: '12:00', days: ['mon', 'wed', 'fri'],                              enabled: true,  next_fire_at: daysFromNow(1) },
    { user_id: patients[7].id, type: 'symptom',  time: '20:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], enabled: true,  next_fire_at: daysFromNow(1) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 25. BROADCASTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding broadcasts…');

  await db.insert(schema.broadcasts).values([
    { created_by: admins[0].id, audience: 'all',      type: 'announcement', title: 'Welcome to TMJConnect 2.0!',                        body: 'We have launched a completely redesigned platform with improved exercise tracking, detailed symptom analytics, and direct messaging with your care team. Explore the new features in the app today.', channels: ['email', 'push'], recipient_count: 16, scheduled_at: daysAgo(30), sent_at: daysAgo(30) },
    { created_by: admins[0].id, audience: 'provider', type: 'update',       title: 'New clinical notes feature available',              body: 'Providers can now add structured clinical notes to patient records. Notes are never visible to patients and support tags for easy filtering. Access via the patient detail screen.', channels: ['email'], recipient_count: 5, scheduled_at: daysAgo(14), sent_at: daysAgo(14) },
    { created_by: admins[1].id, audience: 'patient',  type: 'tip',          title: 'Tip: Track jaw mobility for better insights',       body: 'Did you know you can now log your daily jaw opening measurement? Your provider can use this data to track treatment progress. Try the jaw mobility tracker in the Tracking section.', channels: ['push'], recipient_count: 10, scheduled_at: daysAgo(7), sent_at: daysAgo(7) },
    { created_by: admins[0].id, audience: 'all',      type: 'maintenance',  title: 'Scheduled maintenance — Sunday 2:00–4:00 AM CT',   body: 'TMJConnect will be briefly unavailable for scheduled maintenance this Sunday between 2:00 AM and 4:00 AM Central Time. We apologise for any inconvenience.', channels: ['email'], recipient_count: 16, scheduled_at: daysFromNow(3), sent_at: null },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 26. SCHEDULED REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding scheduled reports…');

  await db.insert(schema.scheduledReports).values([
    { created_by: admins[0].id, name: 'Weekly Active User Summary', entity: 'users', filters: { role: 'patient', is_active: true }, cadence: 'weekly', recipient_emails: ['admin@tmjconnect.dev', 'ops@tmjconnect.dev'], next_run_at: daysFromNow(3), last_run_at: daysAgo(4), enabled: true },
    { created_by: admins[0].id, name: 'Monthly Symptom Trends Export', entity: 'symptom_logs', filters: { period: '30d' }, cadence: 'monthly', recipient_emails: ['admin@tmjconnect.dev'], next_run_at: daysFromNow(14), last_run_at: daysAgo(17), enabled: true },
    { created_by: admins[1].id, name: 'Provider Activity Report', entity: 'reports', filters: { role: 'provider' }, cadence: 'weekly', recipient_emails: ['ops@tmjconnect.dev'], next_run_at: daysFromNow(4), last_run_at: daysAgo(3), enabled: false },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 27. FEATURE FLAGS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding feature flags…');

  await db.insert(schema.featureFlags).values([
    { key: 'new_symptom_ui',           enabled: true,  description: 'New visual symptom logger with body map interaction.',          rollout_percent: 100, target_roles: ['patient'],            updated_by: admins[0].id },
    { key: 'jaw_mobility_tracker',     enabled: true,  description: 'Daily jaw opening measurement logging for patients.',          rollout_percent: 100, target_roles: ['patient'],            updated_by: admins[0].id },
    { key: 'inline_report_responses',  enabled: true,  description: 'Show provider response inline in patient report detail.',      rollout_percent: 100, target_roles: ['patient', 'provider'], updated_by: admins[0].id },
    { key: 'ai_symptom_summary',       enabled: false, description: 'AI-generated plain-language weekly symptom summary for patients. BETA.', rollout_percent: 0, target_roles: ['patient'], updated_by: admins[0].id },
    { key: 'video_telehealth',         enabled: false, description: 'In-app video call for provider-patient consultations. Not yet released.', rollout_percent: 0, target_roles: null,    updated_by: admins[1].id },
    { key: 'clinical_notes_v2',        enabled: true,  description: 'Structured clinical notes with tags and search.',              rollout_percent: 100, target_roles: ['provider'],           updated_by: admins[1].id },
    { key: 'bulk_exercise_assignment', enabled: false, description: 'Allow providers to assign exercise programs to multiple patients at once. In development.', rollout_percent: 0, target_roles: ['provider'], updated_by: admins[0].id },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 28. SUPPORT TICKETS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding support tickets…');

  await db.insert(schema.supportTickets).values([
    { user_id: providers[0].id, category: 'billing',       subject: 'Question about subscription renewal', body: 'Hi, our clinic subscription auto-renewed yesterday but I did not receive an invoice. Can you please send the invoice to billing@austintmj.com?', attach_diagnostic: false, status: 'resolved',    created_at: daysAgo(14) },
    { user_id: providers[1].id, category: 'technical',     subject: 'Patient photo upload failing',       body: 'When patients try to upload a photo with their report, they get an error: "Upload failed — file too large". The images are under 2MB. Can you investigate?', attach_diagnostic: true,  status: 'open',       created_at: daysAgo(3) },
    { user_id: providers[2].id, category: 'feature_request', subject: 'Request: Custom exercise video hosting', body: 'Currently exercise videos link to external URLs. It would be much better if we could upload videos directly to the platform. Many patients struggle with external links.', attach_diagnostic: false, status: 'open', created_at: daysAgo(7) },
    { user_id: providers[3].id, category: 'technical',     subject: 'Notification emails going to spam', body: 'Several of my patients have reported that TMJConnect email notifications are landing in their spam folders. Is this a known issue? Are you using SPF/DKIM?', attach_diagnostic: true,  status: 'in_progress', created_at: daysAgo(5) },
    { user_id: providers[4].id, category: 'account',       subject: 'How do I add a second clinic location?', body: 'I am now seeing patients at two clinic locations. How do I add the second location to my profile? I do not see an option in settings.', attach_diagnostic: false, status: 'resolved', created_at: daysAgo(20) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 29. JOB RUNS (last 30 days of scheduled job history)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding job runs…');

  const jobNames = ['outboxJob', 'reminderJob', 'codeExpiryJob', 'cleanupJob', 'weeklyDigestJob'];
  const jobRunDefs: Parameters<typeof db.insert<typeof schema.jobRuns>>[0] extends (...args: any[]) => any ? never : any[] = [];

  for (let day = 0; day < 30; day++) {
    for (const jobName of jobNames) {
      // outboxJob runs every minute — just seed a few per day.
      // Others run daily/hourly.
      const runs = jobName === 'outboxJob' ? 3 : 1;
      for (let r = 0; r < runs; r++) {
        const startedAt = new Date(daysAgo(day).getTime() + (r * 4 + randomInt(0, 4)) * 60 * 60 * 1000);
        const durationMs = randomInt(50, 3500);
        const finishedAt = new Date(startedAt.getTime() + durationMs);
        const failed = Math.random() < 0.03; // ~3% failure rate.
        await db.insert(schema.jobRuns).values({
          job_name: jobName,
          status: failed ? 'failed' : 'success',
          started_at: startedAt,
          finished_at: finishedAt,
          duration_ms: durationMs,
          rows_affected: failed ? 0 : randomInt(0, 50),
          error_message: failed ? 'ECONNRESET: Connection reset by database pool' : null,
          metadata: { triggeredBy: 'cron', nodeId: 'node-1' },
          created_at: startedAt,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 30. AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding audit logs…');

  await db.insert(schema.auditLogs).values([
    { user_id: admins[0].id,    action: 'admin.user.deactivated',           resource_type: 'user',         resource_id: deactivated.id,    ip_address: '192.168.1.10', user_agent: devices[0], metadata: { statusCode: 200 } },
    { user_id: admins[0].id,    action: 'admin.feature_flag.updated',       resource_type: 'feature_flag',                                   ip_address: '192.168.1.10', user_agent: devices[0], metadata: { key: 'jaw_mobility_tracker', enabled: true } },
    { user_id: admins[1].id,    action: 'admin.broadcast.sent',             resource_type: 'broadcast',                                       ip_address: '10.0.0.5',     user_agent: devices[1], metadata: { audience: 'patient', recipient_count: 10 } },
    { user_id: providers[0].id, action: 'provider.patient.viewed',          resource_type: 'user',         resource_id: patients[0].id,    ip_address: '203.0.113.42', user_agent: devices[2], metadata: { statusCode: 200 } },
    { user_id: providers[0].id, action: 'provider.symptoms.viewed',         resource_type: 'symptom_log',                                     ip_address: '203.0.113.42', user_agent: devices[2], metadata: { patient_id: patients[0].id, statusCode: 200 } },
    { user_id: providers[0].id, action: 'provider.report.responded',        resource_type: 'report',       resource_id: reportIds[0],      ip_address: '203.0.113.42', user_agent: devices[2], metadata: { statusCode: 201 } },
    { user_id: providers[1].id, action: 'provider.report.responded',        resource_type: 'report',       resource_id: reportIds[11],     ip_address: '192.168.1.20', user_agent: devices[0], metadata: { statusCode: 201 } },
    { user_id: providers[0].id, action: 'linking.code.generated',           resource_type: 'linking_code',                                    ip_address: '203.0.113.42', user_agent: devices[2], metadata: { statusCode: 201 } },
    { user_id: patients[0].id,  action: 'linking.code.accepted',            resource_type: 'linking_code',                                    ip_address: '192.168.1.10', user_agent: devices[3], metadata: { statusCode: 201 } },
    { user_id: patients[1].id,  action: 'patient.report.submitted',         resource_type: 'report',       resource_id: reportIds[10],     ip_address: '192.168.1.10', user_agent: devices[1], metadata: { urgency: 'routine', statusCode: 201 } },
    { user_id: patients[2].id,  action: 'patient.report.submitted',         resource_type: 'report',       resource_id: reportIds[11],     ip_address: '192.168.1.10', user_agent: devices[3], metadata: { urgency: 'urgent', statusCode: 201 } },
    { user_id: providers[0].id, action: 'provider.clinical_note.created',   resource_type: 'clinical_note',                                   ip_address: '203.0.113.42', user_agent: devices[0], metadata: { statusCode: 201 } },
    { user_id: null,            action: 'auth.login.failed',                resource_type: null,                                              ip_address: '192.168.1.50', user_agent: 'curl/7.88.1', metadata: { email: 'attacker@example.com', reason: 'invalid_credentials' } },
    { user_id: null,            action: 'auth.login.failed',                resource_type: null,                                              ip_address: '192.168.1.50', user_agent: 'curl/7.88.1', metadata: { email: 'attacker@example.com', reason: 'invalid_credentials' } },
    { user_id: deactivated.id,  action: 'auth.login.failed',                resource_type: 'user',         resource_id: deactivated.id,    ip_address: '127.0.0.1',    user_agent: devices[0], metadata: { reason: 'account_deactivated' } },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 31. LOGIN EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding login events…');

  for (const u of [...providers, ...admins, ...patients]) {
    // 3–8 historical successful logins per user.
    for (let i = 0; i < randomInt(3, 8); i++) {
      await db.insert(schema.loginEvents).values({
        user_id: u.id,
        email: u.email,
        success: true,
        ip_address: ips[randomInt(0, ips.length)],
        device_info: devices[randomInt(0, devices.length)],
        created_at: daysAgo(randomInt(0, 30)),
      });
    }
  }

  // Failed logins (brute force simulation).
  await db.insert(schema.loginEvents).values([
    { email: 'unknown@example.com', success: false, ip_address: '192.168.1.50', device_info: 'curl/7.88.1', failure_reason: 'user_not_found',      created_at: hoursAgo(5) },
    { email: 'unknown@example.com', success: false, ip_address: '192.168.1.50', device_info: 'curl/7.88.1', failure_reason: 'user_not_found',      created_at: hoursAgo(4) },
    { email: patients[0].email,     success: false, ip_address: '10.10.10.10',  device_info: 'python-requests/2.31', failure_reason: 'invalid_credentials', created_at: hoursAgo(2) },
    { user_id: deactivated.id, email: deactivated.email, success: false, ip_address: '127.0.0.1', device_info: devices[0], failure_reason: 'account_deactivated', created_at: hoursAgo(10) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 32. PASSWORD RESETS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding password resets…');

  await db.insert(schema.passwordResets).values([
    { user_id: patients[0].id, token_hash: hashToken('expired-reset-token-alice'),   expires_at: daysAgo(3),    used: true,  created_at: daysAgo(4) },
    { user_id: patients[2].id, token_hash: hashToken('pending-reset-token-carol'),   expires_at: daysFromNow(1), used: false, created_at: hoursAgo(2) },
    { user_id: patients[5].id, token_hash: hashToken('expired-reset-token-frank'),   expires_at: daysAgo(1),    used: false, created_at: daysAgo(2) },
    { user_id: providers[0].id, token_hash: hashToken('used-reset-token-dr-smith'),  expires_at: daysAgo(10),   used: true,  created_at: daysAgo(11) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 33. IDEMPOTENCY KEYS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding idempotency keys…');

  await db.insert(schema.idempotencyKeys).values([
    { key: '550e8400-e29b-41d4-a716-446655440001', response_status: 201, response_body: { status: 'created', resourceId: reportIds[7] },  expires_at: daysFromNow(1) },
    { key: '550e8400-e29b-41d4-a716-446655440002', response_status: 201, response_body: { status: 'created', resourceId: reportIds[10] }, expires_at: daysAgo(1) }, // Expired.
    { key: '550e8400-e29b-41d4-a716-446655440003', response_status: 201, response_body: { status: 'created', resourceId: reportIds[12] }, expires_at: daysFromNow(1) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════════════════════════

  await pool.end();

  console.log('\n✅ Seed complete. Summary:');
  console.log(`   Users:            2 admins, ${providers.length} providers, ${patients.length} patients (+1 unverified, +1 deactivated)`);
  console.log(`   Links:            ${linkDefs.length} active + 2 historical disconnected`);
  console.log(`   Exercises:        ${exerciseIds.length} exercises, ${assignments.length} assignments`);
  console.log(`   Symptom logs:     ${patients.length * 90} entries (90 days × ${patients.length} patients)`);
  console.log(`   Jaw mobility:     ~${Math.round(patients.length * 90 * 0.65)} entries (65% logging rate)`);
  console.log(`   Sleep logs:       ~${Math.round(patients.length * 90 * 0.70)} entries (70% logging rate)`);
  console.log(`   Reports:          ${reportDefs.length} reports, 10 responses`);
  console.log(`   Clinical notes:   ${clinicalNoteDefs.length}`);
  console.log(`   Clinic visits:    ${clinicVisitDefs.length}`);
  console.log(`   Intake forms:     4 forms, 6 assignments, 4 responses`);
  console.log(`   Broadcasts:       4`);
  console.log(`   Feature flags:    7`);
  console.log(`   Support tickets:  5`);
  console.log(`   Job runs:         ~${30 * (jobNames.length + 2)} (30 days history)`);
  console.log(`   Password:         ${SEED_PASSWORD} (all users)`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
