# TMJConnect — Build & Deployment Guide

This document is the single source of truth for how to build, run, and deploy every part of TMJConnect across every environment. It explains **what** each component is, **why** it exists, and **how** it works — so a new engineer can onboard from zero.

Read the [Overview](#overview) first, then skip to the environment you need:

- [Local Development](#local-development) — your laptop
- [Test](#test) — CI, integration tests, pre-merge checks
- [Staging](#staging) — pre-production smoke & QA
- [Production (Pilot)](#production-pilot--vps--systemd--nginx) — VPS + systemd + nginx, 25–50 users
- [Production (Scale)](#production-scale--managed-services) — future managed-services path

Cross-cutting reference:

- [Repository Layout](#repository-layout)
- [Components](#components)
- [Environment Variables](#environment-variables)
- [Secrets Management](#secrets-management)
- [Database Migrations](#database-migrations)
- [Scheduled Jobs](#scheduled-jobs)
- [Observability](#observability)
- [Runbooks](#runbooks)
- [Troubleshooting](#troubleshooting)

---

## Overview

TMJConnect is a HIPAA-aligned orofacial pain management platform consisting of:

- **API** — Express/Node backend (63+ endpoints, JWT auth, Postgres, notifications, storage)
- **Provider portal** — React SPA for clinicians
- **Admin portal** — React SPA for internal ops
- **Patient app** — Expo/React Native (out of scope for this doc)

These components share contract-first Zod schemas and TypeScript types from `@tmjconnect/shared`.

### Architecture at a glance (pilot)

```
                       ┌─────────────────────────────────┐
                       │ Internet                        │
                       └─────────┬───────────────────────┘
                                 │ 443 (TLS)
                       ┌─────────▼───────────────────────┐
                       │ Nginx (reverse proxy + TLS)     │
                       │   • api.tmjconnect.com          │
                       │   • provider.tmjconnect.com     │
                       │   • admin.tmjconnect.com        │
                       └─┬──────────────────────────────┬┘
                         │ /api/                        │ /  (static)
                ┌────────▼─────────┐        ┌───────────▼──────────┐
                │ Express API :3000│        │ Provider / Admin SPA │
                │  (systemd unit)  │        │   (static dist/)     │
                │   • 6 cron jobs  │        └──────────────────────┘
                │   • Sentry scrub │
                │   • Rate limits  │
                └────────┬─────────┘
                         │
                ┌────────▼─────────┐
                │ Postgres 16      │
                │  (systemd unit)  │
                │   • PHI tables   │
                │   • audit_logs   │
                │   • job_runs     │
                │   • rl_* tables  │
                └──────────────────┘
```

All components run as native processes on the host (no containers). The API runs under systemd; nginx serves the SPA bundles as static files and reverse-proxies `/api/*` to the API process; Postgres is a local system service.

---

## Repository Layout

```
tmjconnect/
├── apps/
│   ├── api/                      Express backend (port 3000)
│   │   ├── src/                  Routes, middleware, use-cases, queries, jobs
│   │   ├── drizzle/migrations/   SQL migrations (numbered 0001..)
│   │   ├── tests/                Jest integration + unit tests
│   │   └── drizzle.config.ts     Points drizzle-kit at ./src/db/schema/index.ts
│   ├── provider/                 React SPA (Vite, port 5174 in dev)
│   │   ├── src/                  Pages, features, components
│   │   └── vite.config.ts        Dev proxy, manual chunks, visualizer
│   └── admin/                    Admin SPA
├── packages/
│   └── shared/                   Zod schemas + TypeScript types (workspace dep)
│       └── dist/                 Built output; consumed by api, provider, admin
└── docs/
    ├── API_CHANGELOG.md          Endpoint-level changelog (v1.0.0, v1.1.0…)
    ├── openapi.yaml              OpenAPI 3.1 spec (Swagger UI at /docs in dev)
    ├── RUNBOOK.md                Ops playbook for incidents
    ├── SETUP_CHECKLIST.md        First-deploy checklist
    └── DEPLOYMENT.md             ← you are here
```

### Why a monorepo?

- **Shared types are a compile-time contract.** `packages/shared` exports Zod schemas that both the backend (route validation) and the frontend (form validation, TanStack Query result typing) consume. A backend field rename breaks the frontend typecheck before runtime.
- **Atomic PRs.** A schema change + the backend use-case + the frontend form that consumes it land in one commit. No cross-repo version skew.
- **Single dependency tree.** `npm install` at the repo root resolves every workspace.

---

## Components

### 1. `@tmjconnect/shared`

- **What:** Zod validation schemas, inferred TypeScript types, shared constants (notification types, pagination defaults, regex patterns).
- **Why:** Contract-first. The API validates input against these schemas; the frontend reuses them for forms; the generated types flow to both. One source of truth.
- **How:** Plain TypeScript → `tsc` compiles `src/` to `dist/`. The API imports from `@tmjconnect/shared` which resolves via npm workspaces. In tests, `jest.config.ts` remaps imports to the raw `src/` (no rebuild needed per test run).

**Build:** `npm run build --workspace=packages/shared`
**When to rebuild:** whenever you change a schema or constant. Backend `tsc` will not pick up changes until shared `dist/` is refreshed.

### 2. Express API (`apps/api`)

- **What:** 63+ REST endpoints, JWT auth (access + rotating refresh), Postgres via Drizzle, Resend email, Twilio SMS, Firebase FCM, multer uploads, node-cron scheduled jobs.
- **Why:** Only backend in the system. Owns all PHI writes, enforces authorization, emits audit logs.
- **How:**
  - Entry: [apps/api/src/index.ts](../apps/api/src/index.ts). Boots: env validation → db pool → container (DI) → middleware chain → routers → cron registration → server.listen.
  - Middleware order (important): `requestLogger` → `rateLimiters.general` → `helmet(CSP)` → `cors` → `express.json` → `attachDb` (puts `db`/`logger` on `req`) → routes → `errorHandler`.
  - Route-level chain: `authenticate` → `authorize(role)` → `[checkSessionTimeout for providers/admins]` → `validate(schema, 'body'|'query'|'params')` → `auditLog(action, resource_type)` → handler.
  - Handler pattern: routes do HTTP only; use-cases do business logic; queries do DB only. `res.locals.auditResourceId = row.id` in create handlers so audit rows get the correct resource id.
  - Graceful shutdown: `SIGTERM` → stop accepting connections → drain in-flight → close pool → exit.

**Build:** `npm run build --workspace=apps/api` → `dist/`
**Runtime:** `node apps/api/dist/index.js` (in production, supervised by systemd)

### 3. Provider portal (`apps/provider`)

- **What:** React 18 + Vite + Tailwind + shadcn/ui + TanStack Query + React Router. Clinical workflows for providers (patients, reports, notes, exercises, linking, settings).
- **Why:** Web portal for clinician-facing features that are awkward on mobile (long reports, tables, typing).
- **How:**
  - Code-split per route (`React.lazy`) and per patient-detail tab (Symptoms, Assignments, Reports, Notes). Each chunk loads on demand.
  - Shared vendor chunks: `react`, `radix`, `query`, `cmdk`, `date`, `icons`, `forms`, `toast`. Cached independently — vendor lib updates don't bust the whole cache.
  - Dev proxy: `/api/*` → `http://localhost:3000/api/*`. No CORS needed locally.
  - Prod: nginx serves `dist/` directly as static files; XHR to same-origin `/api/*` is reverse-proxied to the API process.

**Build:** `npm run build --workspace=@tmjconnect/provider` → `apps/provider/dist/`
**Dev:** `npm run dev:provider` → Vite dev server on `:5174`
**Runtime:** the `dist/` directory is the artifact; ship it to the server and point nginx `root` at it.

### 4. Admin portal (`apps/admin`)

- **What:** Internal operations SPA (user management, outbox monitor, audit log, system metrics).
- **Build:** `npm run build --workspace=@tmjconnect/admin` → `apps/admin/dist/`
- **Runtime:** same pattern as provider — nginx serves `dist/` on its own vhost.

### 5. Postgres 16

- **What:** Single primary database. Tables: users, profiles, provider_details, sessions, auth (tokens, codes, MFA), symptom_logs, reports, report_responses, report_requests, clinical_notes, exercises, exercise_assignments, exercise_completions, patient_provider_links, linking_codes, reminders, notifications, notification_outbox, notification_preferences, audit_logs, idempotency_keys, job_runs, rl_* (rate limiter).
- **Why:** Relational model fits PHI (referential integrity, foreign keys, triggers). Same engine in dev, test, and prod — no driver surprises.
- **How:** Accessed via Drizzle ORM. Schema is the source of truth in TypeScript (`apps/api/src/db/schema/*.ts`); migrations are hand-written SQL in `apps/api/drizzle/migrations/*.sql` to retain full control over triggers, indexes, and ALTERs.
- **Install:** apt/brew package, run under systemd (`postgresql.service`). Listen on `localhost` only; do not expose port 5432 to the internet.

**Triggers that matter:**
- `enforce_symptom_edit_window` — rejects UPDATE on `symptom_logs` older than 24h (HIPAA data-integrity guard).

**Partial unique constraints:**
- `patient_provider_links (patient_id, provider_id) WHERE unlinked_at IS NULL` — prevents duplicate active links while permitting re-linking after disconnect.

### 6. Nginx (reverse proxy)

- **What:** TLS termination, HTTP→HTTPS redirect, security headers (HSTS, X-Frame-Options, CSP), rate limiting at the edge, static file serving for uploads and SPAs.
- **Why:**
  - **TLS.** Express shouldn't terminate TLS in production.
  - **Belt-and-suspenders rate limits.** Express has `rate-limiter-flexible`; nginx has `limit_req`. Two independent layers.
  - **Static serving.** Letting nginx serve `dist/` and uploaded files is much faster than routing them through Node.
  - **Multi-origin SPA routing.** One nginx, three hostnames (api, provider, admin), one certbot.
- **How:** installed as a system package, config lives in `/etc/nginx/`. TLS cipher suite is fixed to TLS 1.2+ with HIPAA-aligned AEAD ciphers. CSP is distinct per SPA origin and whitelists the API origin + Google Fonts.

### 7. Certbot (Let's Encrypt)

- **What:** Automated TLS certificate issuance and renewal.
- **Why:** HIPAA requires encryption in transit. Let's Encrypt is free, automated, and universally trusted.
- **How:** installed as an apt package. `certbot --nginx` issues and installs certs on first run; the package ships a systemd timer (`certbot.timer`) that runs `certbot renew` twice daily.

### 8. Storage

- **What:** File storage for avatars, exercise videos, report photos.
- **Why:** PHI content (photos on reports, patient-uploaded media).
- **How:** Abstracted via `StorageDriver` interface in [apps/api/src/services/storage.ts](../apps/api/src/services/storage.ts).
  - **Pilot:** `local` driver. Writes to a host directory (default `/var/lib/tmjconnect/uploads`), served by nginx at `/uploads/*`.
  - **Production scale:** `s3` driver. PUT to S3 with `ServerSideEncryption: AES256`. Delivered via CloudFront signed URLs.
  - Switch by changing `STORAGE_DRIVER=local|s3` env var. Zero code changes.

### 9. External services

| Service | Purpose | Env vars | Fallback |
|---|---|---|---|
| **Resend** | Transactional email | `RESEND_API_KEY` | Logs to pino if key missing (dev) |
| **Twilio** | SMS (MFA, urgent reports) | `TWILIO_*` | Skipped if unset |
| **Firebase FCM** | Mobile push notifications | `FIREBASE_*` | Skipped if unset |
| **Sentry** | Error tracking | `SENTRY_DSN` | No-op if unset |

All four require a **BAA** (Business Associate Agreement) before touching live PHI. See [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md).

---

## Environment Variables

Defined and validated in [apps/api/src/config/env.ts](../apps/api/src/config/env.ts). The API refuses to start if any required variable is missing or malformed (fail-fast).

### Required in every environment

| Variable | Format | Purpose |
|---|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` | Drives Swagger UI, sample rates, log levels |
| `PORT` | int 1–65535 | API listen port (default 3000) |
| `DATABASE_URL` | `postgresql://...` | Primary DB connection string |
| `JWT_SECRET` | min 32 chars | Signs access tokens |
| `JWT_REFRESH_SECRET` | min 32 chars | Signs refresh tokens (separate secret = defense in depth) |
| `MFA_ENCRYPTION_KEY` | exactly 64 hex chars | AES-256-GCM key for MFA secrets at rest |
| `ALLOWED_ORIGINS` | comma-separated URLs | CORS whitelist |
| `APP_URL` | URL | Used in email links (reset, invite) |
| `API_URL` | URL | Used in storage URLs for local driver |

### Optional (feature-gated)

| Variable | Enables | Notes |
|---|---|---|
| `SENTRY_DSN` | Error tracking | PII scrubber auto-applies |
| `RESEND_API_KEY` | Email sending | Required in prod, optional in dev |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_PHONE_NUMBER` | SMS | Required for patient MFA |
| `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | Push notifications | Required for mobile app |
| `STORAGE_DRIVER` | `local` (default) or `s3` | |
| `UPLOAD_DIR` | Local storage path | Default `./uploads` in dev; `/var/lib/tmjconnect/uploads` in prod |
| `S3_BUCKET` + `S3_REGION` + `CLOUDFRONT_URL` | S3 driver | Required if `STORAGE_DRIVER=s3` |
| `JWT_SECRET_PREVIOUS` | Key rotation grace period | Accepts tokens signed with old key for N hours |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` | Default `info` in prod |

### Where they live

| Environment | Source of vars |
|---|---|
| Local dev | [apps/api/.env](../apps/api/.env) — gitignored |
| Test | [apps/api/tests/helpers/testEnv.ts](../apps/api/tests/helpers/testEnv.ts) — hardcoded for deterministic tests |
| Staging | Secrets manager (AWS Secrets Manager / Doppler / Vault) → `/etc/tmjconnect/api.env` on server, loaded by the systemd unit |
| Production | Same as staging, different values |

**Never commit `.env` files. The `.env.example` files are templates.**

---

## Secrets Management

### Rules

1. **Separate secrets per environment.** Dev JWT secret ≠ staging JWT secret ≠ prod JWT secret. Compromising one doesn't compromise the others.
2. **Minimum 32 chars for JWT secrets, 64 hex for MFA key.** The env validator enforces this — it will refuse to boot with weak keys.
3. **Rotation:** change `JWT_SECRET`, keep old as `JWT_SECRET_PREVIOUS` for a 24-hour grace period (so tokens in flight still validate). After 24h, remove `JWT_SECRET_PREVIOUS`.
4. **MFA key rotation is harder.** Rotating invalidates every stored MFA secret (patients + providers need to re-enroll). Only rotate if compromised.
5. **Never log secrets.** Pino log config redacts `password`, `token`, `code`, `secret`, `authorization`, `cookie`. Sentry's `beforeSend` repeats this.

### Generating secrets

```bash
# JWT secrets (64 base64 chars)
openssl rand -base64 48

# MFA encryption key (64 hex chars = 32 bytes for AES-256)
openssl rand -hex 32

# Postgres password (alphanumeric, avoid shell-special chars)
openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32
```

---

## Database Migrations

### Philosophy

**We write SQL migrations by hand, not `drizzle-kit generate`.** Why:

- We need triggers, check constraints, partial unique indexes, data backfills — things Drizzle's generator can't express.
- Reviewers reading the migration want one clear SQL file, not a multi-step plan.
- Auditors reading HIPAA evidence want the DDL that produced the schema, not a JSON diff.

### Lifecycle

1. **Write schema change** in `apps/api/src/db/schema/*.ts` (TypeScript, for Drizzle query typing).
2. **Write migration SQL** in `apps/api/drizzle/migrations/NNNN_description.sql`. Number sequentially. Use `CREATE TABLE IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object ...` for enums, and `ADD COLUMN IF NOT EXISTS` for alters so re-runs are idempotent.
3. **Apply to local dev DB:**
   ```
   npm run db:migrate --workspace=apps/api
   ```
4. **Apply to test DB:**
   ```
   DATABASE_URL=postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect_test \
     npm run db:migrate --workspace=apps/api
   ```
5. **Update [API_CHANGELOG.md](API_CHANGELOG.md)** and [openapi.yaml](openapi.yaml) if endpoints changed.
6. **Apply to staging**, run smoke tests.
7. **Apply to production** during a low-traffic window. For destructive migrations, take a backup first.

### Safety rules

- **Backfill before enforcing.** If adding a `NOT NULL` column: first `ADD COLUMN` nullable, backfill data, then `ALTER COLUMN SET NOT NULL` in a follow-up migration.
- **Never drop columns in the same deploy that removes references.** Two-stage: deploy code that no longer reads/writes → wait one release → drop the column.
- **`audit_logs` is sacred.** The cleanupJob explicitly skips it (6-year HIPAA retention). Migrations must not truncate or re-shape it without an approved retention plan.

### Current migration count

See [apps/api/drizzle/migrations/](../apps/api/drizzle/migrations/).

---

## Scheduled Jobs

Six jobs run inside the API process via `node-cron`. Registered in [apps/api/src/jobs/index.ts](../apps/api/src/jobs/index.ts).

| Job | Schedule | Purpose | Lock ID |
|---|---|---|---|
| `reminderJob` | `* * * * *` (every minute) | Fires due exercise/symptom reminders from the `reminders` table | 1 |
| `codeExpiryJob` | `0 * * * *` (hourly) | Marks expired `linking_codes`, deletes stale `idempotency_keys` | 2 |
| `weeklyDigestJob` | `5 * * * *` (5 past every hour) | Fires weekly digests where `next_digest_at <= NOW()` | 3 |
| `cleanupJob` | `0 3 * * *` (3 AM daily) | Hard-deletes soft-deleted users after retention window (HIPAA) | 4 |
| `orphanFileCleanupJob` | `0 4 * * *` (4 AM daily) | Deletes storage blobs no longer referenced by any record | 5 |
| `outboxJob` | `* * * * *` (every minute) | Drains `notification_outbox` to Resend/Twilio/FCM | 6 |

### Why advisory locks

Each job acquires a Postgres advisory lock before running (`pg_try_advisory_lock($lockId)`). If a second API instance tries to run the same job concurrently, it silently skips. This means you can run multiple API replicas without duplicate work or race conditions.

### Job health

Every run writes to `job_runs` (started_at, finished_at, duration_ms, status, error_message, rows_affected). The admin portal's Job runner health panel surfaces this for monitoring.

### Disabling jobs in a specific instance

If you run the API in worker-only or web-only mode, set `CRON_ENABLED=false`. Useful when running multiple replicas where only one should handle cron.

---

## Observability

### Logs (pino)

Structured JSON logs, one line per request. Includes `requestId` (uuid v4 per request) that correlates:

- Pino log line
- Audit log row (`metadata.requestId`)
- Sentry error event (`tags.request_id`)

```json
{"level":30,"time":1712345678901,"requestId":"7c3...","method":"POST","path":"/api/v1/reports","status":201,"duration_ms":42,"user_id":"abc..."}
```

In production the API runs under systemd; logs go to journald via stdout. Tail with `journalctl -u tmjconnect-api -f`. Ship to your log backend (Papertrail, Loki, CloudWatch) via `systemd-journal-upload` or a log-forwarding agent of choice.

### Metrics

Admin-facing metrics at `GET /admin/system/metrics` (not Prometheus; hand-rolled aggregates for the admin UI). For external monitoring, start with Sentry performance traces — free tier is sufficient for pilot scale.

### Errors (Sentry)

Initialized by [apps/api/src/config/sentry.ts](../apps/api/src/config/sentry.ts). **PII scrubbing is mandatory** — the `beforeSend` hook:

- Strips 30+ PII keys (email, phone, name, dob, address, pain_level, body_areas, triggers, notes, patient_notes, description, etc.)
- Redacts any key whose name contains `phi`
- Removes `authorization` and `cookie` headers
- Drops query strings entirely (can contain tokens)
- Keeps only `user.id` (never email)

If `SENTRY_DSN` is not set, Sentry is a no-op. **Always set it in staging and production.**

### Health check

`GET /health` — unauthenticated, no rate limit bypass needed. Queries `SELECT 1` with a 2-second timeout. Returns:

- `200 { status: 'healthy', checks: { database: 'ok', uptime: N } }`
- `503 { status: 'unhealthy', checks: { database: 'failed' } }`

Configure your uptime monitor and systemd's `ExecStartPost=` / external health probe to hit this every 30s.

### Audit logs

Every PHI-touching route attaches `auditLog(action, resource_type)` middleware. On response finish, an `audit_logs` row is inserted with `user_id`, `action`, `resource_type`, `resource_id`, `ip_address`, `user_agent`, `metadata.requestId`, `statusCode`. Fire-and-forget — audit failures log to Sentry but never fail the request.

**Retention:** 6 years minimum (HIPAA). `cleanupJob` explicitly avoids this table.

---

## Local Development

See [DEV_STACK.md](DEV_STACK.md) for the full native-host setup. In short:

```bash
# 1. Install deps
npm install

# 2. Build shared
npm run build --workspace=packages/shared

# 3. Create dev + test databases in your local Postgres
psql postgres <<'SQL'
CREATE ROLE tmjconnect WITH LOGIN PASSWORD 'dev_password';
CREATE DATABASE tmjconnect      OWNER tmjconnect;
CREATE DATABASE tmjconnect_test OWNER tmjconnect;
SQL

# 4. Copy env template and fill secrets
cp apps/api/.env.example apps/api/.env

# 5. Migrate and seed
npm run db:migrate --workspace=apps/api
npm run db:seed    --workspace=apps/api

# 6. Run services (separate terminals)
npm run dev:api
npm run dev:provider
npm run dev:admin
```

### Port map (dev)

| Port | Service |
|---|---|
| 3000 | API |
| 5174 | Provider portal (Vite) |
| 5173 | Admin portal (Vite) |
| 8081 | Patient app (Expo) |
| 5432 | Postgres (single instance, dev + test DBs) |

---

## Test

### Running tests

```bash
# Full suite (~3 min)
npm run test --workspace=apps/api

# Single file
npx jest tests/integration/reports.test.ts --runInBand

# Single test
npx jest -t "idempotent on Idempotency-Key replay" --runInBand

# Watch mode
npx jest --watch --runInBand
```

### Why `--runInBand`

Tests share a real Postgres instance. Running in parallel would race on `truncateAllTables`. `jest.config.ts` pins `maxWorkers: 1`.

### CI configuration

CI uses GitHub Actions' native Postgres service container (a GHA feature — not part of our deploy surface) to run integration tests against Postgres 16. See [.github/workflows/ci.yml](../.github/workflows/ci.yml).

### Test database lifecycle

1. CI spins up a fresh Postgres via GitHub Actions service containers.
2. Run all migrations against it.
3. Tests truncate between describe blocks.
4. The CI service is destroyed at job end.

No migration rollback logic — we always migrate forward from an empty DB.

### Coverage targets

Current: 235+ tests across 12 suites. Key surfaces covered:

- Route-level integration for every router (auth, patients, providers, reports, linking, admin, symptoms, outbox, queries).
- PHI link scoping (provider can't access unlinked patient data).
- Idempotency key replay (reports).
- Refresh-token rotation + reuse detection + family burn.
- DB triggers (24h symptom edit window).
- Sentry PII scrubbing (unit).
- Security headers (helmet, nginx).

---

## Staging

### Purpose

- **Final smoke test** before prod deploys.
- **Load testing** (k6 / Artillery) against production-equivalent infrastructure.
- **Manual QA** for features not fully covered by automated tests.
- **Integration rehearsal** for new third-party services (Twilio BAA, S3 migration, etc.).

### Topology

Identical to production: same systemd units, same nginx config, same TLS, same Sentry integration — but:

- Smaller VPS (1–2 GB RAM is fine).
- Different secrets (mandatory; never reuse prod secrets).
- Subdomain: `api.staging.tmjconnect.com`, `provider.staging.tmjconnect.com`.
- `NODE_ENV=production` (staging runs as "production" for realistic behaviour).
- **Fake PHI only.** Use seeded synthetic data. Real PHI in staging is a HIPAA violation unless staging is BAA-covered.
- Separate Sentry project (`SENTRY_ENVIRONMENT=staging`).
- Separate Resend API key + sender domain (or use Resend test mode).

### Deploy flow

Same as production, but against the staging host. Usually wired as a GitHub Actions job that SSHes to the staging server on every push to `main`:

```yaml
deploy-staging:
  needs: test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to staging
      run: |
        ssh deploy@staging.tmjconnect.com "cd /opt/tmjconnect && \
          git pull && \
          npm ci && \
          npm run build --workspace=packages/shared && \
          npm run build --workspace=apps/api && \
          npm run build --workspace=apps/provider && \
          npm run build --workspace=apps/admin && \
          npm run db:migrate --workspace=apps/api && \
          sudo systemctl restart tmjconnect-api"
```

---

## Production (Pilot) — VPS + systemd + nginx

### Target

25–50 concurrent users. Single-host deployment. HIPAA-aligned but not multi-region HA.

### Hardware

- **VPS:** 4 vCPU, 8 GB RAM, 80 GB SSD (Hetzner CX31 / DigitalOcean droplet / Linode).
- **Bandwidth:** 5 TB/month minimum (video uploads are heavy).
- **Region:** same region as majority of users (latency).
- **OS:** Ubuntu 22.04 LTS.
- **Backups:** enable daily VPS snapshots (provider-level) + nightly logical `pg_dump` to object storage (see [scripts/backup.sh](../scripts/backup.sh)).

### First-time host setup

```bash
# SSH in as a non-root admin user with sudo
ssh admin@tmjconnect-prod

# System packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw nginx postgresql-16 git build-essential certbot python3-certbot-nginx

# Node 20 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Firewall
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP (redirect to 443)
sudo ufw allow 443    # HTTPS
sudo ufw enable

# Postgres — create role and databases
sudo -u postgres psql <<'SQL'
CREATE ROLE tmjconnect_api WITH LOGIN PASSWORD '<strong-random-pw>';
CREATE DATABASE tmjconnect OWNER tmjconnect_api;
SQL
# Pin PostgreSQL to localhost-only in /etc/postgresql/16/main/postgresql.conf
#   listen_addresses = 'localhost'
# Restart:  sudo systemctl restart postgresql

# App user + directory
sudo useradd --system --home /opt/tmjconnect --shell /bin/false tmjconnect
sudo mkdir -p /opt/tmjconnect /var/lib/tmjconnect/uploads /etc/tmjconnect
sudo chown -R tmjconnect:tmjconnect /opt/tmjconnect /var/lib/tmjconnect
sudo chmod 750 /etc/tmjconnect

# Pull the repo
sudo -u tmjconnect git clone <repo> /opt/tmjconnect
cd /opt/tmjconnect

# Install and build
sudo -u tmjconnect npm ci
sudo -u tmjconnect npm run build --workspace=packages/shared
sudo -u tmjconnect npm run build --workspace=apps/api
sudo -u tmjconnect npm run build --workspace=apps/provider
sudo -u tmjconnect npm run build --workspace=apps/admin

# Environment file (loaded by the systemd unit)
sudo vim /etc/tmjconnect/api.env
# Required keys: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, MFA_ENCRYPTION_KEY,
#                ALLOWED_ORIGINS, APP_URL, API_URL, UPLOAD_DIR=/var/lib/tmjconnect/uploads,
#                RESEND_API_KEY, TWILIO_*, FIREBASE_*, SENTRY_DSN.
sudo chown root:tmjconnect /etc/tmjconnect/api.env
sudo chmod 640 /etc/tmjconnect/api.env

# systemd unit
sudo tee /etc/systemd/system/tmjconnect-api.service >/dev/null <<'UNIT'
[Unit]
Description=TMJConnect API
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=tmjconnect
Group=tmjconnect
WorkingDirectory=/opt/tmjconnect/apps/api
EnvironmentFile=/etc/tmjconnect/api.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5s
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/tmjconnect
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now tmjconnect-api
sudo journalctl -u tmjconnect-api -f   # sanity check

# nginx vhosts
sudo vim /etc/nginx/sites-available/tmjconnect
# Configure three server{} blocks:
#   api.tmjconnect.com       → proxy_pass http://127.0.0.1:3000
#   provider.tmjconnect.com  → root /opt/tmjconnect/apps/provider/dist; try_files $uri /index.html
#   admin.tmjconnect.com     → root /opt/tmjconnect/apps/admin/dist;    try_files $uri /index.html
# Serve /uploads/ from /var/lib/tmjconnect/uploads (read-only).
# Add security headers (HSTS, X-Frame-Options, CSP) and limit_req zones.
sudo ln -s /etc/nginx/sites-available/tmjconnect /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS certs (after DNS A records point at the host)
sudo certbot --nginx \
  -d api.tmjconnect.com \
  -d provider.tmjconnect.com \
  -d admin.tmjconnect.com \
  --email ops@tmjconnect.com --agree-tos --no-eff-email

# Apply migrations
sudo -u tmjconnect bash -c 'set -a; source /etc/tmjconnect/api.env; set +a; \
  npm run db:migrate --workspace=apps/api'

# Smoke test
curl -fsS https://api.tmjconnect.com/health
curl -fsS https://provider.tmjconnect.com | head
```

### Rolling deploys

A single-host systemd deploy has a ~1–2 s window during `systemctl restart` where the API is unavailable; nginx returns 502 briefly and your uptime monitor may blip. For pilot scale, acceptable. For stricter SLAs, see [Production (Scale)](#production-scale--managed-services).

Typical deploy:

```bash
cd /opt/tmjconnect
sudo -u tmjconnect git pull
sudo -u tmjconnect npm ci
sudo -u tmjconnect npm run build --workspace=packages/shared
sudo -u tmjconnect npm run build --workspace=apps/api
sudo -u tmjconnect npm run build --workspace=apps/provider
sudo -u tmjconnect npm run build --workspace=apps/admin

# Migrate first (forward-only)
sudo -u tmjconnect bash -c 'set -a; source /etc/tmjconnect/api.env; set +a; \
  npm run db:migrate --workspace=apps/api'

# Restart API
sudo systemctl restart tmjconnect-api
sudo journalctl -u tmjconnect-api -n 50 --no-pager

# SPAs are served from disk — nginx picks up the new bundles on next request.
# No nginx reload needed unless vhost config changed.
```

### Rollback

The deployable artifact is the git commit + `dist/` trees. To roll back:

```bash
cd /opt/tmjconnect
sudo -u tmjconnect git checkout <previous-tag>
sudo -u tmjconnect npm ci
sudo -u tmjconnect npm run build --workspace=packages/shared
sudo -u tmjconnect npm run build --workspace=apps/api
sudo -u tmjconnect npm run build --workspace=apps/provider
sudo -u tmjconnect npm run build --workspace=apps/admin
sudo systemctl restart tmjconnect-api
```

For a bad migration: apply a **forward** reversal migration (new file, higher number, e.g. `0008_revert_0007_...`). Never `drizzle-kit drop` — it's destructive and breaks state tracking.

### Backups

**Postgres logical dump (nightly):** use [scripts/backup.sh](../scripts/backup.sh). It runs `pg_dump | gzip | gpg` in a single pipeline so plaintext PHI never touches disk. Install on the host:

```bash
sudo cp /opt/tmjconnect/scripts/backup.sh /opt/tmjconnect/backup.sh
sudo chmod +x /opt/tmjconnect/backup.sh
echo "STRONG_RANDOM_PASSPHRASE" | sudo tee /opt/tmjconnect/.backup_passphrase
sudo chmod 600 /opt/tmjconnect/.backup_passphrase

# Cron
sudo crontab -e
# Add:
# 0 2 * * * /opt/tmjconnect/backup.sh >> /var/log/tmjconnect-backup.log 2>&1
```

**Uploads:** back up `/var/lib/tmjconnect/uploads` nightly to object storage (`rclone` or `aws s3 sync`).

**Restore drill:** every quarter, run [scripts/restore-drill.sh](../scripts/restore-drill.sh). HIPAA auditors will ask.

### Certificate renewal

The `certbot` apt package installs `certbot.timer` which runs `certbot renew` twice daily. Verify with `systemctl list-timers | grep certbot`. On successful renewal, certbot's deploy hook reloads nginx automatically.

### Monitoring

Minimum viable:

1. **Uptime check** against `https://api.tmjconnect.com/health` (UptimeRobot, Better Stack, Upptime).
2. **Sentry alerts** on error rate spikes.
3. **Disk space alert** on the VPS (`df -h /`).
4. **Certbot renewal failures** → check `systemctl status certbot.timer` + journald email alerts.
5. **systemd unit health** → alert if `tmjconnect-api.service` state != `active (running)`.

---

## Production (Scale) — Managed Services

Once the pilot outgrows a single VPS (~500 users or >10 TB/month), move to a managed provider. Two reasonable paths:

### Path A: AWS (ECS Fargate + RDS + S3/CloudFront)

```
Route53 → CloudFront → S3 (provider/admin dist buckets)
          ALB + ACM  → ECS Fargate service (API tasks from ECR image)
                        ├─► RDS Postgres 16 (Multi-AZ)
                        ├─► S3 (uploads, SSE-AES256)
                        └─► CloudFront signed URLs
```

### Path B: PaaS (Fly.io / Render / Railway + managed Postgres)

Push the API as a long-running process, point DNS at the provider's edge, use their managed Postgres. Simpler IaC surface than AWS; less flexibility when you need it.

### Migration path (either way)

1. **Extract secrets** into the provider's secrets manager (one secret per `.env` variable).
2. **Create managed Postgres** (RDS Multi-AZ or equivalent). Restore the latest encrypted `pg_dump` from the pilot host.
3. **Build release artifact** for the API (image, bundle, whatever the provider expects). If the provider needs an image, you'll reintroduce a narrow Dockerfile for the API only — scoped to build output, not dev tooling.
4. **Provision load balancer + TLS** (ALB+ACM on AWS; built-in on Fly/Render).
5. **Put provider/admin `dist/` on object storage + CDN.** Invalidate on each deploy.
6. **Swap `STORAGE_DRIVER=s3`** and migrate uploads from the pilot VPS to the bucket (`aws s3 sync`).
7. **Cut DNS** from the pilot VPS to the new front door.
8. Run the pilot for another week in read-only mode (firewall-block writes) so you can fall back if needed. Then decommission.

### What changes in code: nothing

The API is environment-agnostic. The storage driver switch is an env var. The cron jobs use advisory locks and will safely run across N tasks.

### What you gain

- Zero-downtime deploys (rolling updates).
- Horizontal scaling (multiple API replicas).
- Multi-AZ database failover.
- CDN edge caching for SPAs (faster global load).

### What you lose

- Cost: ~$250/month baseline on AWS vs. ~$30/month for a pilot VPS.
- Complexity: IaC (Terraform/CDK) becomes mandatory.

---

## Runbooks

### Adding a new API endpoint (the happy path)

1. Write Zod schema in `packages/shared/src/schemas/*.schemas.ts`.
2. Export it from `packages/shared/src/index.ts` (automatic via `export *`).
3. `npm run build --workspace=packages/shared`.
4. Write the DB query in `apps/api/src/db/queries/*.queries.ts`.
5. Write the use-case in `apps/api/src/use-cases/*/...ts`. Shape: `execute(deps, input)` with `Deps = Pick<Container, ...>`.
6. Wire the route in `apps/api/src/routes/*.ts` with full middleware chain.
7. Write integration tests in `apps/api/tests/integration/*.test.ts`. Cover happy path, 403 (unauthorized), 404 (not found), 400 (validation).
8. Update [docs/openapi.yaml](openapi.yaml) and [docs/API_CHANGELOG.md](API_CHANGELOG.md).
9. `npm run test --workspace=apps/api` — all green.
10. Wire the frontend (if applicable): TanStack Query hook → component → RHF form.

### Rotating the JWT secret

```bash
# 1. Generate new secret
NEW=$(openssl rand -base64 48)

# 2. Update /etc/tmjconnect/api.env:
#    JWT_SECRET_PREVIOUS=<current JWT_SECRET>
#    JWT_SECRET=$NEW

# 3. Restart
sudo systemctl restart tmjconnect-api

# 4. Wait 24 hours. All tokens signed with the old secret have now expired
#    (access token TTL is 15 min; refresh token is rotated on every use).

# 5. Remove JWT_SECRET_PREVIOUS from /etc/tmjconnect/api.env and restart again.
```

### Investigating a 500 spike

1. Check Sentry for the top error of the last 15 min.
2. Confirm the `requestId` on any affected log line.
3. Grep pino logs: `sudo journalctl -u tmjconnect-api | grep <requestId>`.
4. Cross-reference with `audit_logs.metadata.requestId` for what the user was doing.
5. Check `job_runs` — did a cron job fail and leave DB in a bad state?
6. Check Postgres metrics (`pg_stat_activity`, connection count, lock waits).
7. If it's a regression from a recent deploy, roll back via `git checkout <previous-tag>` + rebuild.

### A user reports their data is gone

1. Confirm their `user_id` in `users` table. If `deleted_at IS NOT NULL`, they (or an admin) soft-deleted their account.
2. Check `audit_logs WHERE user_id = X ORDER BY created_at DESC LIMIT 20` — who did what when.
3. If soft-delete was within retention window (before `cleanupJob` fired), restore: `UPDATE users SET deleted_at = NULL WHERE id = X`.
4. If `cleanupJob` already fired (hard-delete), the data is gone — restore from last `pg_dump`. This is a disclosed incident under HIPAA breach rules if PHI was unavailable ≥ a threshold time.

### Onboarding a new provider

Automated via `/auth/provider/register`. No manual DB work required. Admins can verify the account via `PATCH /admin/users/:id { verified: true }` if needed.

### Database lock wait

```sql
-- Find blocking queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- Kill a runaway
SELECT pg_terminate_backend(<pid>);
```

---

## Troubleshooting

### `API refuses to start: "MFA_ENCRYPTION_KEY must be exactly 64 hex characters"`

Env validator is doing its job. Check `/etc/tmjconnect/api.env`:

```bash
sudo grep MFA_ENCRYPTION_KEY /etc/tmjconnect/api.env | awk -F= '{print length($2)}'
# must print 64
```

Regenerate with `openssl rand -hex 32`.

### `Tests fail: "relation 'report_requests' does not exist"`

Latest migration not applied to the test DB. See [Database Migrations](#database-migrations).

### `nginx: 502 Bad Gateway` on the API vhost

API process isn't running. `sudo systemctl status tmjconnect-api` → check state. `sudo journalctl -u tmjconnect-api -n 100 --no-pager` → check why it crashed.

### `Provider portal shows blank page, console has 404 on /assets/index-*.js`

Build artifact missing or stale. Rebuild and confirm `apps/provider/dist/assets/index-*.js` exists on disk:

```bash
sudo -u tmjconnect npm run build --workspace=apps/provider
ls /opt/tmjconnect/apps/provider/dist/assets/ | head
```

nginx serves directly from disk — no reload needed.

### `Let's Encrypt: rate limit exceeded`

Staging and prod share Let's Encrypt's rate limits per domain. Use the staging ACME endpoint for testing:

```bash
sudo certbot --nginx --staging -d api.tmjconnect.com
```

Re-issue against prod once your nginx config is stable.

### `Postgres: too many connections`

Pool is misconfigured or a leak. `pgOpts` in [apps/api/src/config/database.ts](../apps/api/src/config/database.ts) caps at 20. Check `SELECT count(*) FROM pg_stat_activity WHERE datname='tmjconnect'`. If >> 20, you have multiple API instances or a pool leak — reconcile.

### `CORS errors in browser console`

`ALLOWED_ORIGINS` in `/etc/tmjconnect/api.env` doesn't include the origin hitting the API. Check exact scheme + host + port match. No trailing slashes.

### `429 Rate limit exceeded` on a legit request

Rate-limiter-flexible's Postgres table is IP-keyed. If you're behind a proxy without `trust proxy`, every request appears to come from the same IP. Confirm `app.set('trust proxy', 1)` is set and nginx forwards `X-Forwarded-For`.

### `Clinical notes endpoint returns 403 FORBIDDEN`

The provider isn't linked to that patient. Check `patient_provider_links WHERE provider_id = X AND patient_id = Y AND unlinked_at IS NULL`. The use-case calls `verifyProviderLink` on every notes/reports/assignments route.

---

## Appendix: First-deploy checklist

Copy from [docs/SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) on first prod deploy:

- [ ] BAAs signed (Resend, Twilio, Firebase, hosting provider)
- [ ] Secrets rotated (never reuse dev values)
- [ ] `ALLOWED_ORIGINS` includes all three production subdomains
- [ ] DNS A records point to the VPS
- [ ] Let's Encrypt certs issued for all three subdomains
- [ ] Sentry project created, DSN in env file, test event visible in dashboard
- [ ] Migrations applied
- [ ] Uptime check configured against `/health`
- [ ] `pg_dump` backup script + cron installed
- [ ] Uploads directory backup configured
- [ ] Firewall (`ufw`) only allows 22/80/443
- [ ] SSH: key-only auth, root login disabled
- [ ] Monitoring: disk space, Sentry rate, certbot renewal, systemd unit health
- [ ] Admin user created (first provider account promoted to admin via SQL)
- [ ] Smoke tests pass: register, verify email, login, MFA, submit report

Once every box is checked, the pilot is live.
