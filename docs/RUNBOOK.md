# TMJConnect API — Operations Runbook

This runbook covers production deployment, hardening, and incident response for the TMJConnect API. It is the source of truth for ops tasks that are NOT automated in the CI/CD pipeline.

> **Status:** This document is incrementally populated. Sections marked _TODO_ are planned but not yet authoritative. Add entries as soon as a procedure is exercised against a real environment.

---

## 1. Database Setup (Production)

### 1.1 Create the application role

The migrations and runtime should NOT run as the PostgreSQL superuser. Create a least-privilege role for the API and grant only what it needs.

```sql
-- Run as a superuser (e.g. `postgres`):
CREATE ROLE tmjconnect_api LOGIN PASSWORD '<strong-random-password>';
GRANT CONNECT ON DATABASE tmjconnect TO tmjconnect_api;
GRANT USAGE ON SCHEMA public TO tmjconnect_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tmjconnect_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tmjconnect_api;

-- Future tables/sequences should inherit the same grants:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tmjconnect_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tmjconnect_api;
```

After this, set `DATABASE_URL` in the deployed environment to use `tmjconnect_api` (NOT `postgres`).

### 1.2 HIPAA hardening — append-only audit logs

PostgreSQL `audit_logs` and `login_events` MUST be append-only at the role level. The API code already only INSERTs into these tables, but the role-level revoke is the defence-in-depth that survives a compromised application:

```sql
-- Run as a superuser AFTER the migration has created the tables and AFTER
-- the tmjconnect_api role exists. Without these statements the architecture
-- spec's HIPAA controls are NOT in effect.
REVOKE UPDATE, DELETE ON audit_logs FROM tmjconnect_api;
REVOKE DELETE ON login_events FROM tmjconnect_api;
```

> **Why these are not in the migration file:** Drizzle migrations run as `tmjconnect_api` itself. A role cannot REVOKE its own privileges. These statements are documented as comments in `apps/api/drizzle/migrations/0001_initial_schema.sql` and applied here, out-of-band, by a DBA.

**Verification** — once applied, these queries should fail for `tmjconnect_api`:

```sql
-- Connect as tmjconnect_api and run:
DELETE FROM audit_logs WHERE id = '00000000-0000-0000-0000-000000000000';
-- ERROR: permission denied for table audit_logs
UPDATE audit_logs SET action = 'tampered' WHERE id = '00000000-0000-0000-0000-000000000000';
-- ERROR: permission denied for table audit_logs
```

If either query succeeds, the hardening is NOT in effect — open an incident immediately.

### 1.3 Migrations

Production deploys MUST use `npm run db:migrate` (which runs `scripts/migrate.ts` against `./drizzle/migrations`).

Do NOT use `npm run db:push` in production — it diffs schema against the live DB and can drop columns/tables without warning. `db:push` is for dev prototyping only.

---

## 2. Backups

### 2.1 Automated daily backup (pilot VPS)

A cron job on the VPS host runs nightly at **02:00 UTC**:

```bash
#!/bin/bash
# /opt/tmjconnect/backup.sh — run via cron: 0 2 * * * /opt/tmjconnect/backup.sh
set -euo pipefail

BACKUP_DIR="/opt/tmjconnect/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/tmjconnect_${TIMESTAMP}.sql.gz.gpg"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

# Dump, compress, and encrypt in a single pipeline — plaintext never touches disk.
docker exec tmjconnect-postgres pg_dump -U tmjconnect_api tmjconnect \
  | gzip \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file /opt/tmjconnect/.backup_passphrase \
  > "${DUMP_FILE}"

chmod 600 "${DUMP_FILE}"

# Prune backups older than retention window.
find "${BACKUP_DIR}" -name "tmjconnect_*.sql.gz.gpg" -mtime +${RETENTION_DAYS} -delete

echo "[$(date -Iseconds)] Backup completed: ${DUMP_FILE}"
```

**Setup steps:**
1. Create `/opt/tmjconnect/.backup_passphrase` with a strong random passphrase. `chmod 600`. This passphrase must NOT be the same as `BACKUP_PASSPHRASE` in the API `.env` — it is host-level only.
2. Add the cron entry: `crontab -e` → `0 2 * * * /opt/tmjconnect/backup.sh >> /var/log/tmjconnect-backup.log 2>&1`
3. Verify first run: `bash /opt/tmjconnect/backup.sh && ls -lh /opt/tmjconnect/backups/`

### 2.2 Restore procedure

```bash
# Decrypt and decompress.
gpg --batch --decrypt --passphrase-file /opt/tmjconnect/.backup_passphrase \
  /opt/tmjconnect/backups/tmjconnect_YYYYMMDD_HHMMSS.sql.gz.gpg \
  | gunzip > /tmp/restore.sql

# Restore to a NEW database (never overwrite production directly).
docker exec -i tmjconnect-postgres psql -U postgres -c "CREATE DATABASE tmjconnect_restore;"
docker exec -i tmjconnect-postgres psql -U postgres -d tmjconnect_restore < /tmp/restore.sql

# Verify row counts against production (spot-check critical tables).
docker exec tmjconnect-postgres psql -U postgres -d tmjconnect_restore \
  -c "SELECT 'users' AS tbl, count(*) FROM users UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs UNION ALL SELECT 'symptom_logs', count(*) FROM symptom_logs;"

# Clean up.
rm /tmp/restore.sql
docker exec tmjconnect-postgres psql -U postgres -c "DROP DATABASE tmjconnect_restore;"
```

### 2.3 Restore drills

Run **monthly**. Record results here:

| Date | Backup file | Row count match? | Duration | Operator |
|------|-------------|------------------|----------|----------|
| _TBD_ | | | | |

### 2.4 Production (AWS RDS)

RDS automated snapshots with 7-day retention are enabled by default. Point-in-time recovery is available within the retention window. No manual backup script is needed — RDS handles it. Verify RDS snapshot settings quarterly.

---

## 3. Incident Response

### 3.1 Severity matrix

| Severity | Definition | Response time | Examples |
|----------|-----------|---------------|---------|
| **P0 — Critical** | Confirmed PHI breach or data loss | Contain within **1 hour** | Unauthorised data access, DB compromise, leaked credentials |
| **P1 — High** | Service outage or security vulnerability | Respond within **4 hours** | API down, DB unreachable, auth bypass, Sentry 5xx spike |
| **P2 — Medium** | Degraded service or non-critical security issue | Respond within **24 hours** | External service down (email/SMS), high error rate, failed backups |
| **P3 — Low** | Cosmetic or operational inconvenience | Respond within **72 hours** | Log rotation full, stale cron job, non-critical deprecation |

### 3.2 On-call contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Primary (AQION TECH) | _[insert phone/Slack]_ | Responds to all pages |
| Secondary (OROFACIAL) | _[insert phone/email]_ | Notified on P0, legal-required on breach |
| Legal counsel | _[insert contact]_ | Engaged on confirmed PHI breach |

### 3.3 Playbooks

#### Database outage
1. Check `GET /health` — if `checks.database: "failed"`, confirm via `docker exec tmjconnect-postgres pg_isready`.
2. Check Docker: `docker compose ps`. Restart if exited: `docker compose up -d postgres`.
3. Check disk space: `df -h`. PostgreSQL crashes on full disk.
4. Check logs: `docker compose logs --tail=50 postgres`.
5. If data corruption: stop API, restore from latest backup (Section 2.2), investigate root cause.

#### Sentry error spike (P1)
1. Open Sentry dashboard. Filter by `requestId` tag to isolate the failing path.
2. Check if the spike correlates with a deploy (rollback if so: `docker compose pull && docker compose up -d` with previous image tag).
3. Check external service status pages (Resend, Twilio, Firebase).
4. If the error is in auth or audit code paths: treat as potential P0 until ruled out.

#### Suspected data breach (P0)
1. **Contain immediately:** Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` (forces all users to re-login). Rotate `DATABASE_URL` password if DB compromise suspected.
2. Preserve evidence: `docker compose logs > /tmp/incident-$(date +%s).log` before any restarts.
3. Query scope: `SELECT user_id, action, created_at FROM audit_logs WHERE created_at > '<suspected_start>' ORDER BY created_at;`
4. Query login anomalies: `SELECT * FROM login_events WHERE created_at > '<suspected_start>' AND success = false ORDER BY created_at;`
5. Notify OROFACIAL leadership within 1 hour.
6. Follow HIPAA notification requirements per architecture doc Section 14.8.

#### Compromised credentials
1. Identify which credentials: API keys, DB password, JWT secrets, SSH keys.
2. Rotate the compromised credential immediately.
3. If JWT secret: all issued tokens are invalid. Users must re-login.
4. If DB password: update `DATABASE_URL` in environment and restart the API.
5. If SSH key: `ssh-keygen` new deploy key, update GitHub Actions secret, revoke old key on VPS.
6. Audit access logs for the exposure period.

### 3.4 Post-mortem template

After any P0 or P1 incident, file a post-mortem within 48 hours:

```
# Incident Post-Mortem: [Title]
**Date:** YYYY-MM-DD
**Severity:** P0/P1
**Duration:** HH:MM (detection to resolution)
**Author:** [name]

## Timeline
- HH:MM — [event]

## Root Cause
[What caused the incident]

## Impact
[Users affected, data exposed, downtime duration]

## Resolution
[What was done to fix it]

## Action Items
- [ ] [Preventive measure] — owner — due date
```

---

## 4. Deployment

### 4.1 CI/CD (GitHub Actions)

_Workflow file: `.github/workflows/deploy.yml` — to be created._

Expected flow:
1. Push to `main` → trigger workflow.
2. `npm ci` → `npm run build` → `npm test` (against test DB in CI).
3. Build Docker image → push to GitHub Container Registry (GHCR).
4. SSH into VPS → `docker compose pull` → `docker compose up -d`.
5. Wait 10s → `curl -f https://api.tmjconnect.com/health` → verify 200.

### 4.2 Manual deployment (fallback)

```bash
# On the VPS:
cd /opt/tmjconnect
docker compose pull
docker compose up -d

# Verify:
curl -sf http://localhost:3000/health | jq .
# Expected: { "status": "healthy", "checks": { "database": "ok" } }
```

### 4.3 Rollback procedure

```bash
# 1. Identify the previous working image tag.
docker compose logs api --tail=5  # check current tag in startup log

# 2. Pin to previous image in docker-compose.yml or override:
API_IMAGE=ghcr.io/aqion-tech/tmjconnect-api:previous-sha docker compose up -d

# 3. Verify health.
curl -sf http://localhost:3000/health | jq .

# 4. If the rollback involves a DB migration:
#    Do NOT run migrations backward. Write a forward migration to undo the schema change.
#    See architecture doc Section 6.1.2 (fix-forward strategy).
```

### 4.4 Post-deploy smoke test checklist

- [ ] `GET /health` returns 200 with `database: "ok"`
- [ ] `POST /auth/patient/login` with test credentials returns tokens
- [ ] `GET /patients/me` with valid token returns profile
- [ ] Sentry test event appears in dashboard (trigger via `GET /debug-sentry` in staging only)
- [ ] Check `docker compose logs api --tail=20` for startup errors

---

## 5. Routine Operations

### 5.1 Rotating credentials

| Credential | How to rotate | Impact |
|------------|--------------|--------|
| `JWT_SECRET` | Generate new 64-char hex (`openssl rand -hex 32`), update `.env`, restart API | All active access tokens invalidated. Users must refresh or re-login. |
| `JWT_REFRESH_SECRET` | Same as above | All refresh tokens invalidated. All users forced to re-login. |
| `MFA_ENCRYPTION_KEY` | **Cannot rotate without re-encrypting all `mfa_secret` values.** Write a migration script that decrypts with old key and re-encrypts with new key. | If done wrong, all provider MFA breaks. Test in staging first. |
| `DATABASE_URL` password | Update in PostgreSQL (`ALTER ROLE tmjconnect_api PASSWORD '...'`), update `.env`, restart API | Brief downtime during restart (~2s with graceful shutdown). |
| `RESEND_API_KEY` | Regenerate in Resend dashboard, update `.env`, restart | Emails fail until restart completes. |
| `TWILIO_AUTH_TOKEN` | Regenerate in Twilio console, update `.env`, restart | SMS MFA fails until restart completes. |

### 5.2 Adding a new admin user

Admin users are created via direct SQL (no self-registration endpoint):

```bash
# 1. Generate a password hash.
node -e "const b=require('bcryptjs');b.hash('TempPass@1234!',12).then(h=>console.log(h))"

# 2. Insert the user + profile + notification preferences.
docker exec -i tmjconnect-postgres psql -U tmjconnect_api tmjconnect <<SQL
BEGIN;
INSERT INTO users (id, email, password_hash, role, email_verified, is_active)
VALUES (uuid_generate_v4(), 'admin@tmjconnect.com', '<hash-from-step-1>', 'admin', true, true);
INSERT INTO profiles (user_id, first_name, last_name)
VALUES ((SELECT id FROM users WHERE email = 'admin@tmjconnect.com'), 'Admin', 'User');
INSERT INTO notification_preferences (user_id)
VALUES ((SELECT id FROM users WHERE email = 'admin@tmjconnect.com'));
COMMIT;
SQL

# 3. The admin must complete MFA setup on first login (same flow as providers).
# 4. Change the temporary password immediately after first login.
```

### 5.3 Verifying scheduled jobs are running

| Job | Cron | How to verify last run |
|-----|------|----------------------|
| `reminderJob` | `* * * * *` (every minute) | `SELECT * FROM notifications WHERE type IN ('exercise_reminder','symptom_checkin') ORDER BY created_at DESC LIMIT 5;` |
| `codeExpiryJob` | `0 * * * *` (hourly) | `SELECT count(*) FROM linking_codes WHERE status = 'expired';` — should increase over time |
| `weeklyDigestJob` | `0 * * * *` (hourly) | `SELECT * FROM notifications WHERE type = 'weekly_summary' ORDER BY created_at DESC LIMIT 5;` |
| `cleanupJob` | `0 3 * * *` (daily 3 AM) | Check application logs: `docker compose logs api --since="3h" | grep cleanupJob` |
| `orphanFileCleanupJob` | `0 4 * * *` (daily 4 AM) | Check application logs: `docker compose logs api --since="3h" | grep orphanFileCleanup` |

If a job has not fired when expected, check:
1. Is the API container running? `docker compose ps`
2. Is the DB reachable? `GET /health`
3. Check for advisory lock contention: `SELECT * FROM pg_locks WHERE locktype = 'advisory';`

---

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-04-11 | Initial runbook with database setup + HIPAA hardening section | — |
| 2026-04-11 | Populated sections 2–5: backups, incident response, deployment, routine operations | — |
