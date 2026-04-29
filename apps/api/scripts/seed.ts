/**
 * Database seeder — populates all tables with realistic development data.
 *
 * Usage:
 *   npm run db:seed
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
      notifications, notification_preferences, reminders,
      audit_logs, login_events, idempotency_keys
    RESTART IDENTITY CASCADE
  `);

  const passwordHash = await hashPw(SEED_PASSWORD);
  console.log(`All seed users share password: ${SEED_PASSWORD}`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. USERS + PROFILES + PROVIDER DETAILS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding users…');

  // ─── Admin ────────────────────────────────────────────────────────────────────
  const [admin] = await db.insert(schema.users).values({
    email: 'admin@tmjconnect.dev',
    password_hash: passwordHash,
    role: 'admin',
    email_verified: true,
    is_active: true,
    mfa_enabled: true,
    mfa_secret: encryptCode('JBSWY3DPEHPK3PXP'), // Fake TOTP secret.
    tos_accepted_at: daysAgo(30),
    tos_version: '1.0',
  }).returning({ id: schema.users.id });

  await db.insert(schema.profiles).values({
    user_id: admin.id,
    first_name: 'Admin',
    last_name: 'User',
    timezone: 'America/Chicago',
  });

  // ─── Providers ────────────────────────────────────────────────────────────────
  const providerData = [
    { email: 'dr.smith@tmjconnect.dev', first: 'Sarah', last: 'Smith', license: 'TX-DDS-001', type: 'DDS', specialty: 'Orofacial Pain', clinic: 'Austin TMJ Center' },
    { email: 'dr.jones@tmjconnect.dev', first: 'Michael', last: 'Jones', license: 'TX-DDS-002', type: 'DMD', specialty: 'Oral Surgery', clinic: 'Dallas Jaw Clinic' },
    { email: 'dr.chen@tmjconnect.dev', first: 'Lisa', last: 'Chen', license: 'CA-PT-003', type: 'PT', specialty: 'Physical Therapy', clinic: 'SF Pain Relief' },
  ];

  const providers: { id: string; email: string }[] = [];
  for (const p of providerData) {
    const [user] = await db.insert(schema.users).values({
      email: p.email,
      password_hash: passwordHash,
      role: 'provider',
      email_verified: true,
      is_active: true,
      mfa_enabled: true,
      mfa_secret: encryptCode('JBSWY3DPEHPK3PXP'), // Fake TOTP secret.
      tos_accepted_at: daysAgo(60),
      tos_version: '1.0',
    }).returning({ id: schema.users.id });

    await db.insert(schema.profiles).values({
      user_id: user.id,
      first_name: p.first,
      last_name: p.last,
      timezone: 'America/Chicago',
    });

    await db.insert(schema.providerDetails).values({
      user_id: user.id,
      license_number: p.license,
      license_type: p.type,
      specialty: p.specialty,
      clinic_name: p.clinic,
      credentials: p.type === 'DDS' ? ['DDS', 'FAAOP'] : [p.type],
    });

    providers.push({ id: user.id, email: p.email });
  }

  // ─── Patients ─────────────────────────────────────────────────────────────────
  const patientData = [
    { email: 'alice@tmjconnect.dev', first: 'Alice', last: 'Johnson', dob: '1990-03-15', gender: 'female', city: 'Austin', state: 'TX', tz: 'America/Chicago' },
    { email: 'bob@tmjconnect.dev', first: 'Bob', last: 'Williams', dob: '1985-07-22', gender: 'male', city: 'Dallas', state: 'TX', tz: 'America/Chicago' },
    { email: 'carol@tmjconnect.dev', first: 'Carol', last: 'Davis', dob: '1995-11-08', gender: 'female', city: 'San Francisco', state: 'CA', tz: 'America/Los_Angeles' },
    { email: 'dave@tmjconnect.dev', first: 'Dave', last: 'Martinez', dob: '1988-01-30', gender: 'male', city: 'Houston', state: 'TX', tz: 'America/Chicago' },
    { email: 'eva@tmjconnect.dev', first: 'Eva', last: 'Brown', dob: '1992-09-05', gender: 'female', city: 'Denver', state: 'CO', tz: 'America/Denver' },
  ];

  const patients: { id: string; email: string }[] = [];
  for (const p of patientData) {
    const [user] = await db.insert(schema.users).values({
      email: p.email,
      password_hash: passwordHash,
      role: 'patient',
      email_verified: true,
      is_active: true,
      mfa_enabled: false,
      tos_accepted_at: daysAgo(14),
      tos_version: '1.0',
    }).returning({ id: schema.users.id });

    await db.insert(schema.profiles).values({
      user_id: user.id,
      first_name: p.first,
      last_name: p.last,
      date_of_birth: p.dob,
      gender: p.gender,
      city: p.city,
      state: p.state,
      timezone: p.tz,
    });

    patients.push({ id: user.id, email: p.email });
  }

  // Unverified patient (for testing registration flow).
  const [unverified] = await db.insert(schema.users).values({
    email: 'newuser@tmjconnect.dev',
    password_hash: passwordHash,
    role: 'patient',
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
  });

  // Deactivated patient (for testing admin deactivation).
  const [deactivated] = await db.insert(schema.users).values({
    email: 'deactivated@tmjconnect.dev',
    password_hash: passwordHash,
    role: 'patient',
    email_verified: true,
    is_active: false,
  }).returning({ id: schema.users.id, email: schema.users.email });

  await db.insert(schema.profiles).values({
    user_id: deactivated.id,
    first_name: 'Deactivated',
    last_name: 'Account',
    timezone: 'America/Chicago',
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. NOTIFICATION PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding notification preferences…');

  const allActiveUsers = [admin, ...providers, ...patients];
  await db.insert(schema.notificationPreferences).values(
    allActiveUsers.map((u) => ({ user_id: u.id })),
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. SESSIONS (providers and admin need active sessions)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding sessions…');

  for (const p of [...providers, admin]) {
    await db.insert(schema.sessions).values({
      user_id: p.id,
      device_info: 'Seed script — Chrome/macOS',
      ip_address: '127.0.0.1',
      last_active: new Date(),
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
      device_info: 'Seed — Chrome',
      expires_at: daysFromNow(7),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. MFA BACKUP CODES (for providers)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding MFA backup codes…');

  for (const p of providers) {
    const codes = Array.from({ length: 10 }, () => randomBytes(5).toString('hex'));
    const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));
    await db.insert(schema.mfaBackupCodes).values(
      hashed.map((h) => ({ user_id: p.id, code_hash: h })),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. PATIENT-PROVIDER LINKS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding patient-provider links…');

  // Dr. Smith manages Alice, Bob, Dave.
  // Dr. Jones manages Bob, Carol.
  // Dr. Chen manages Carol, Eva.
  const links = [
    { patient: patients[0], provider: providers[0] }, // Alice ↔ Smith
    { patient: patients[1], provider: providers[0] }, // Bob ↔ Smith
    { patient: patients[3], provider: providers[0] }, // Dave ↔ Smith
    { patient: patients[1], provider: providers[1] }, // Bob ↔ Jones
    { patient: patients[2], provider: providers[1] }, // Carol ↔ Jones
    { patient: patients[2], provider: providers[2] }, // Carol ↔ Chen
    { patient: patients[4], provider: providers[2] }, // Eva ↔ Chen
  ];

  for (const l of links) {
    await db.insert(schema.patientProviderLinks).values({
      patient_id: l.patient.id,
      provider_id: l.provider.id,
      linked_at: daysAgo(randomInt(7, 60)),
    });
  }

  // One disconnected link (historical).
  await db.insert(schema.patientProviderLinks).values({
    patient_id: patients[0].id,
    provider_id: providers[1].id,
    linked_at: daysAgo(90),
    unlinked_at: daysAgo(30),
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. LINKING CODES
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding linking codes…');

  await db.insert(schema.linkingCodes).values([
    { code: 'ABC123', provider_id: providers[0].id, status: 'pending', expires_at: daysFromNow(7) },
    { code: 'XYZ789', provider_id: providers[1].id, status: 'pending', expires_at: daysFromNow(5) },
    { code: 'OLD001', provider_id: providers[0].id, status: 'expired', expires_at: daysAgo(1) },
    { code: 'USE001', provider_id: providers[2].id, patient_id: patients[4].id, status: 'connected', expires_at: daysAgo(3) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. EXERCISES
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding exercises…');

  const exerciseData = [
    { provider: providers[0], title: 'Jaw Stretch (Lateral)', desc: 'Gently move your jaw side to side while keeping your mouth slightly open.', dur: 120, cat: 'Stretching', inst: '1. Open mouth slightly\n2. Move jaw to the left, hold 5 seconds\n3. Return to center\n4. Move jaw to the right, hold 5 seconds\n5. Repeat 10 times' },
    { provider: providers[0], title: 'Chin Tuck', desc: 'Pull your chin straight back while keeping your head level.', dur: 60, cat: 'Posture', inst: '1. Sit upright\n2. Pull chin straight back (make a "double chin")\n3. Hold for 5 seconds\n4. Release\n5. Repeat 10 times' },
    { provider: providers[0], title: 'Mouth Opening (Resistance)', desc: 'Open your mouth against gentle thumb resistance.', dur: 90, cat: 'Strengthening', inst: '1. Place thumb under chin\n2. Open mouth slowly against resistance\n3. Hold 5 seconds\n4. Close slowly\n5. Repeat 10 times' },
    { provider: providers[1], title: 'Neck Side Bend', desc: 'Tilt your head to one side to stretch the neck muscles connected to the jaw.', dur: 60, cat: 'Stretching', inst: '1. Sit upright\n2. Tilt head to left (ear toward shoulder)\n3. Hold 15 seconds\n4. Return to center\n5. Repeat on right side\n6. Do 5 sets' },
    { provider: providers[2], title: 'Tongue Up Exercise', desc: 'Place tongue on the roof of your mouth while opening and closing.', dur: 45, cat: 'Coordination', inst: '1. Place tongue on the roof of mouth\n2. Slowly open mouth wide\n3. Slowly close\n4. Keep tongue in position throughout\n5. Repeat 15 times' },
    { provider: providers[2], title: 'Relaxation Breathing', desc: 'Deep breathing to reduce jaw tension and clenching.', dur: 180, cat: 'Relaxation', inst: '1. Sit comfortably with lips apart\n2. Inhale through nose for 4 counts\n3. Hold for 4 counts\n4. Exhale through mouth for 6 counts\n5. Repeat for 3 minutes' },
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
    }).returning({ id: schema.exercises.id });
    exerciseIds.push(row.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 9. EXERCISE ASSIGNMENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding exercise assignments…');

  const assignments = [
    { exercise: exerciseIds[0], patient: patients[0].id, provider: providers[0].id, freq: 'daily', sets: 3 },
    { exercise: exerciseIds[1], patient: patients[0].id, provider: providers[0].id, freq: 'daily', sets: 2 },
    { exercise: exerciseIds[2], patient: patients[1].id, provider: providers[0].id, freq: '3x weekly', sets: 2 },
    { exercise: exerciseIds[3], patient: patients[1].id, provider: providers[1].id, freq: 'daily', sets: 1 },
    { exercise: exerciseIds[4], patient: patients[2].id, provider: providers[2].id, freq: 'daily', sets: 2 },
    { exercise: exerciseIds[5], patient: patients[4].id, provider: providers[2].id, freq: 'daily', sets: 1 },
    // Paused assignment.
    { exercise: exerciseIds[0], patient: patients[3].id, provider: providers[0].id, freq: 'daily', sets: 1, status: 'paused' as const },
  ];

  const assignmentIds: string[] = [];
  for (const a of assignments) {
    const [row] = await db.insert(schema.exerciseAssignments).values({
      exercise_id: a.exercise,
      patient_id: a.patient,
      provider_id: a.provider,
      frequency: a.freq,
      sets: a.sets,
      status: a.status ?? 'active',
      assigned_at: daysAgo(randomInt(3, 30)),
    }).returning({ id: schema.exerciseAssignments.id });
    assignmentIds.push(row.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 10. EXERCISE COMPLETIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding exercise completions…');

  // Alice completed assignments 0 and 1 for the past 7 days.
  for (let day = 0; day < 7; day++) {
    await db.insert(schema.exerciseCompletions).values([
      { assignment_id: assignmentIds[0], patient_id: patients[0].id, completed_at: daysAgo(day) },
      { assignment_id: assignmentIds[1], patient_id: patients[0].id, completed_at: daysAgo(day) },
    ]);
  }
  // Bob completed assignment 2 for 3 days.
  for (let day = 0; day < 3; day++) {
    await db.insert(schema.exerciseCompletions).values({
      assignment_id: assignmentIds[2], patient_id: patients[1].id, completed_at: daysAgo(day),
    });
  }
  // Carol completed assignment 4 for 5 days.
  for (let day = 0; day < 5; day++) {
    await db.insert(schema.exerciseCompletions).values({
      assignment_id: assignmentIds[4], patient_id: patients[2].id, completed_at: daysAgo(day),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 11. SYMPTOM LOGS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding symptom logs…');

  const painTypes = ['aching', 'sharp', 'throbbing', 'dull', 'shooting'];
  const bodyAreas = [
    [{ area: 'jaw', side: 'left' }],
    [{ area: 'jaw', side: 'right' }],
    [{ area: 'jaw', side: 'left' }, { area: 'temple', side: 'left' }],
    [{ area: 'neck', side: 'both' }],
    [{ area: 'jaw', side: 'both' }, { area: 'ear', side: 'right' }],
  ];
  const triggersList = ['chewing', 'stress', 'cold weather', 'yawning', 'clenching', 'sleeping'];

  // Generate 14 days of symptom logs for each patient.
  for (const patient of patients) {
    for (let day = 0; day < 14; day++) {
      const logDate = daysAgo(day);
      const pain = Math.max(1, Math.min(10, Math.round(5 + (Math.random() - 0.5) * 6)));
      await db.insert(schema.symptomLogs).values({
        patient_id: patient.id,
        pain_level: pain,
        pain_types: [painTypes[randomInt(0, painTypes.length)], painTypes[randomInt(0, painTypes.length)]],
        body_areas: bodyAreas[randomInt(0, bodyAreas.length)],
        duration_minutes: randomInt(10, 180),
        triggers: [triggersList[randomInt(0, triggersList.length)]],
        notes: day === 0 ? 'Pain has been improving this week with regular exercises.' : null,
        logged_at: logDate,
        created_at: logDate,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 12. REPORTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding reports…');

  const reportData = [
    { patient: patients[0], provider: providers[0], urgency: 'routine' as const, pain: 4, desc: 'Weekly check-in. Pain is manageable with exercises.', status: 'reviewed' as const, daysAgo: 7 },
    { patient: patients[0], provider: providers[0], urgency: 'routine' as const, pain: 3, desc: 'Continuing improvement. Jaw stretches helping.', status: 'submitted' as const, daysAgo: 0 },
    { patient: patients[1], provider: providers[0], urgency: 'concerning' as const, pain: 7, desc: 'Pain increased after dental work. Difficulty opening mouth fully.', status: 'responded' as const, daysAgo: 3 },
    { patient: patients[1], provider: providers[1], urgency: 'routine' as const, pain: 5, desc: 'Neck exercises have been helping with jaw tension.', status: 'viewed' as const, daysAgo: 2 },
    { patient: patients[2], provider: providers[1], urgency: 'urgent' as const, pain: 9, desc: 'Severe pain episode. Unable to eat solid food. Clicking has worsened.', status: 'responded' as const, daysAgo: 1, flagged: true },
    { patient: patients[2], provider: providers[2], urgency: 'routine' as const, pain: 5, desc: 'Tongue exercises improving coordination.', status: 'submitted' as const, daysAgo: 0 },
    { patient: patients[3], provider: providers[0], urgency: 'routine' as const, pain: 3, desc: 'Minimal symptoms this week. Stress management helping.', status: 'reviewed' as const, daysAgo: 5 },
    { patient: patients[4], provider: providers[2], urgency: 'concerning' as const, pain: 6, desc: 'Jaw locking episodes twice this week. Breathing exercises reduce tension.', status: 'submitted' as const, daysAgo: 0 },
  ];

  const reportIds: string[] = [];
  for (const r of reportData) {
    const submitted = daysAgo(r.daysAgo);
    const [row] = await db.insert(schema.reports).values({
      patient_id: r.patient.id,
      provider_id: r.provider.id,
      urgency: r.urgency,
      pain_level: r.pain,
      description: r.desc,
      status: r.status,
      flagged: r.flagged ?? false,
      summary_data: { avg_pain: r.pain, exercises_completed: randomInt(3, 15) },
      period_start: daysAgo(r.daysAgo + 7),
      period_end: submitted,
      submitted_at: submitted,
      viewed_at: r.status !== 'submitted' ? new Date(submitted.getTime() + 2 * 60 * 60 * 1000) : null,
      reviewed_at: r.status === 'reviewed' || r.status === 'responded' ? new Date(submitted.getTime() + 4 * 60 * 60 * 1000) : null,
    }).returning({ id: schema.reports.id });
    reportIds.push(row.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 13. REPORT RESPONSES
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding report responses…');

  await db.insert(schema.reportResponses).values([
    {
      report_id: reportIds[0],
      provider_id: providers[0].id,
      message: 'Great progress, Alice. Keep up the jaw stretches daily. Let me know if pain increases.',
      internal_notes: 'Patient responding well to conservative treatment. Continue current plan.',
      responded_at: daysAgo(6),
    },
    {
      report_id: reportIds[2],
      provider_id: providers[0].id,
      message: 'I understand the pain after dental work. Try soft foods for 48h and apply ice 15 min on/off. If it does not improve by Friday, call the office.',
      internal_notes: 'Post-procedural flare. Monitor for trismus. May need imaging if not resolved in 1 week.',
      responded_at: daysAgo(2),
    },
    {
      report_id: reportIds[4],
      provider_id: providers[1].id,
      message: 'Carol, I am concerned about the severity. Please come in for an emergency evaluation tomorrow morning. In the meantime, soft diet only and ice packs.',
      internal_notes: 'Suspected disc displacement with reduction. Urgent MRI recommended. Flagged for priority.',
      responded_at: hoursAgo(6),
    },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 14. NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding notifications…');

  const notificationData = [
    { user: patients[0].id, type: 'exercise_reminder', title: 'Time for your exercises', body: 'You have 2 exercises to complete today.', read: true },
    { user: patients[0].id, type: 'report_reviewed', title: 'Report reviewed', body: 'Dr. Smith has reviewed your weekly report.', read: true },
    { user: patients[0].id, type: 'exercise_reminder', title: 'Time for your exercises', body: 'You have 2 exercises to complete today.', read: false },
    { user: patients[1].id, type: 'provider_message', title: 'Message from Dr. Smith', body: 'I understand the pain after dental work. Try soft foods...', read: false },
    { user: patients[2].id, type: 'provider_message', title: 'Urgent: Dr. Jones responded', body: 'Carol, I am concerned about the severity. Please come in...', read: false },
    { user: patients[2].id, type: 'exercise_assigned', title: 'New exercise assigned', body: 'Dr. Chen has assigned you a new Tongue Up Exercise.', read: true },
    { user: providers[0].id, type: 'report_submitted', title: 'New report from Alice', body: 'Alice Johnson submitted a routine weekly check-in.', read: true, data: { reportId: reportIds[1] } },
    { user: providers[0].id, type: 'report_urgent', title: 'Concerning report from Bob', body: 'Bob Williams reported increased pain (7/10).', read: false, data: { reportId: reportIds[2] } },
    { user: providers[1].id, type: 'report_submitted', title: 'Urgent report from Carol', body: 'Carol Davis reported severe pain episode (9/10).', read: true, data: { reportId: reportIds[4] } },
    { user: patients[4].id, type: 'symptom_checkin', title: 'Daily check-in reminder', body: 'How are you feeling today? Log your symptoms.', read: false },
  ];

  for (const n of notificationData) {
    await db.insert(schema.notifications).values({
      user_id: n.user,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data ?? {},
      read: n.read,
      read_at: n.read ? hoursAgo(randomInt(1, 24)) : null,
      created_at: hoursAgo(randomInt(1, 72)),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 15. REMINDERS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding reminders…');

  await db.insert(schema.reminders).values([
    { user_id: patients[0].id, type: 'exercise', time: '09:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'], enabled: true, next_fire_at: daysFromNow(1) },
    { user_id: patients[0].id, type: 'symptom', time: '20:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], enabled: true, next_fire_at: daysFromNow(1) },
    { user_id: patients[1].id, type: 'exercise', time: '08:00', days: ['mon', 'wed', 'fri'], enabled: true, next_fire_at: daysFromNow(1) },
    { user_id: patients[2].id, type: 'exercise', time: '10:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'], enabled: true, next_fire_at: daysFromNow(1) },
    { user_id: patients[2].id, type: 'symptom', time: '21:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], enabled: true, next_fire_at: daysFromNow(1) },
    { user_id: patients[3].id, type: 'exercise', time: '07:30', days: ['mon', 'tue', 'wed', 'thu', 'fri'], enabled: false }, // Disabled.
    { user_id: patients[4].id, type: 'exercise', time: '09:30', days: ['mon', 'tue', 'wed', 'thu', 'fri'], enabled: true, next_fire_at: daysFromNow(1) },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 16. AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding audit logs…');

  await db.insert(schema.auditLogs).values([
    { user_id: admin.id, action: 'admin_user_updated', resource_type: 'user', resource_id: deactivated.id, ip_address: '127.0.0.1', metadata: { method: 'PATCH', path: `/admin/users/${deactivated.id}`, statusCode: 200 } },
    { user_id: providers[0].id, action: 'provider_viewed_patient_symptoms', resource_type: 'symptom_log', ip_address: '127.0.0.1', metadata: { method: 'GET', path: `/providers/patients/${patients[0].id}/symptoms`, statusCode: 200 } },
    { user_id: providers[0].id, action: 'linking_code_generated', resource_type: 'linking_code', ip_address: '127.0.0.1', metadata: { method: 'POST', path: '/linking/codes', statusCode: 201 } },
    { user_id: patients[0].id, action: 'linking_code_accepted', resource_type: 'linking_code', ip_address: '127.0.0.1', metadata: { method: 'POST', path: '/linking/accept', statusCode: 201 } },
    { user_id: providers[1].id, action: 'provider.report.respond', resource_type: 'report', resource_id: reportIds[4], ip_address: '127.0.0.1', metadata: { method: 'POST', statusCode: 201 } },
    { user_id: null, action: 'auth.login.failed', resource_type: null, ip_address: '192.168.1.50', metadata: { email: 'attacker@example.com', reason: 'invalid_credentials' } },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 17. LOGIN EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding login events…');

  await db.insert(schema.loginEvents).values([
    { user_id: patients[0].id, email: patients[0].email, success: true, ip_address: '127.0.0.1', device_info: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' },
    { user_id: patients[1].id, email: patients[1].email, success: true, ip_address: '127.0.0.1', device_info: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' },
    { user_id: providers[0].id, email: providers[0].email, success: true, ip_address: '127.0.0.1', device_info: 'Mozilla/5.0 (Windows NT 10.0; Win64)' },
    { user_id: providers[1].id, email: providers[1].email, success: true, ip_address: '127.0.0.1', device_info: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' },
    { email: 'unknown@example.com', success: false, ip_address: '192.168.1.50', device_info: 'curl/7.88.1', failure_reason: 'invalid_credentials' },
    { email: 'unknown@example.com', success: false, ip_address: '192.168.1.50', device_info: 'curl/7.88.1', failure_reason: 'invalid_credentials' },
    { user_id: deactivated.id, email: deactivated.email, success: false, ip_address: '127.0.0.1', device_info: 'Mozilla/5.0', failure_reason: 'account_deactivated' },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 18. PASSWORD RESETS (one expired, one pending)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding password resets…');

  await db.insert(schema.passwordResets).values([
    { user_id: patients[0].id, token_hash: hashToken('expired-reset-token-abc'), expires_at: daysAgo(2), used: true },
    { user_id: patients[2].id, token_hash: hashToken('pending-reset-token-xyz'), expires_at: daysFromNow(1), used: false },
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 19. IDEMPOTENCY KEYS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('Seeding idempotency keys…');

  await db.insert(schema.idempotencyKeys).values([
    { key: '550e8400-e29b-41d4-a716-446655440001', response_status: 201, response_body: { status: 'created', resourceId: reportIds[0] }, expires_at: daysFromNow(1) },
    { key: '550e8400-e29b-41d4-a716-446655440002', response_status: 201, response_body: { status: 'created', resourceId: reportIds[1] }, expires_at: daysAgo(1) }, // Expired.
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════════════════════════

  await pool.end();

  console.log('\n✅ Seed complete. Summary:');
  console.log(`   Users:          1 admin, ${providers.length} providers, ${patients.length} patients (+1 unverified, +1 deactivated)`);
  console.log(`   Links:          ${links.length} active + 1 disconnected`);
  console.log(`   Exercises:      ${exerciseIds.length} exercises, ${assignments.length} assignments`);
  console.log(`   Symptom logs:   ${patients.length * 14} entries (14 days × ${patients.length} patients)`);
  console.log(`   Reports:        ${reportData.length} reports, 3 responses`);
  console.log(`   Notifications:  ${notificationData.length}`);
  console.log(`   Reminders:      7`);
  console.log(`   Password:       ${SEED_PASSWORD} (all users)`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
