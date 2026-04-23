# TMJConnect — Build & Deployment Guide

This document is the single source of truth for how to build, run, and deploy every part of TMJConnect across every environment. It explains **what** each component is, **why** it exists, and **how** it works — so a new engineer can onboard from zero.

Read the [Overview](#overview) first, then skip to the environment you need:

- [Local Development](#local-development) — your laptop
- [Test](#test) — CI, integration tests, pre-merge checks
- [Staging](#staging) — pre-production smoke & QA
- [Production (Pilot)](#production-pilot--vps--docker-compose) — VPS + Docker Compose, 25–50 users
- [Production (Scale)](#production-scale--aws-ecs--rds) — future AWS ECS + RDS path

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
- **Admin portal** — React SPA for internal ops (on `adminPortal` branch; not yet merged to main)
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
                │ Express API :3000 │        │ Provider / Admin SPA │
                │   • 6 cron jobs   │        │   (SPA dist/ files)  │
                │   • Sentry scrub  │        └──────────────────────┘
                │   • Rate limits   │
                └────────┬─────────┘
                         │
                ┌────────▼─────────┐
                │ Postgres 16      │
                │   • PHI tables   │
                │   • audit_logs   │
                │   • job_runs     │
                │   • rl_* tables  │
                └──────────────────┘
```

Every component runs in a Docker container, orchestrated by `docker-compose.yml`, on a single VPS for the pilot. See [docker/docker-compose.yml](../docker/docker-compose.yml).

---

## Repository Layout

```
tmjconnect/
├── apps/
│   ├── api/                      Express backend (port 3000)
│   │   ├── src/                  Routes, middleware, use-cases, queries, jobs
│   │   ├── drizzle/migrations/   SQL migrations (numbered 0001..)
│   │   ├── tests/                Jest integration + unit tests
│   │   ├── Dockerfile            Multi-stage: build → node:20-alpine prod image
│   │   └── drizzle.config.ts     Points drizzle-kit at ./src/db/schema/index.ts
│   ├── provider/                 React SPA (Vite, port 5174 in dev)
│   │   ├── src/                  Pages, features, components
│   │   ├── Dockerfile            Builds dist/ and ships via nginx:alpine image
│   │   └── vite.config.ts        Dev proxy, manual chunks, visualizer
│   └── admin/                    Admin SPA (source on `adminPortal` branch)
├── packages/
│   └── shared/                   Zod schemas + TypeScript types (workspace dep)
│       └── dist/                 Built output; consumed by api, provider, admin
├── docker/
│   ├── docker-compose.yml        Production-like stack: postgres + api + nginx + provider
│   ├── docker-compose.dev.yml    Dev overrides (exposes pg ports, no TLS)
│   ├── nginx.conf                Reverse proxy, TLS termination, security headers
│   └── .env.example              Production env vars template
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
**Runtime:** `node apps/api/dist/index.js`
**Docker:** [apps/api/Dockerfile](../apps/api/Dockerfile) — two stages: `builder` (installs all deps, compiles), `production` (omit-dev deps, copies dist, runs as non-root `node` user, `HEALTHCHECK` against `/health`).

### 3. Provider portal (`apps/provider`)

- **What:** React 18 + Vite + Tailwind + shadcn/ui + TanStack Query + React Router. Clinical workflows for providers (patients, reports, notes, exercises, linking, settings).
- **Why:** Web portal for clinician-facing features that are awkward on mobile (long reports, tables, typing).
- **How:**
  - Code-split per route (`React.lazy`) and per patient-detail tab (Symptoms, Assignments, Reports, Notes). Each chunk loads on demand.
  - Shared vendor chunks: `react`, `radix`, `query`, `cmdk`, `date`, `icons`, `forms`, `toast`. Cached independently — vendor lib updates don't bust the whole cache.
  - Dev proxy: `/api/*` → `http://localhost:3000/api/*`. No CORS needed locally.
  - Prod: SPA served by nginx, XHR to same-origin `/api/*` which nginx proxies to the API container.

**Build:** `npm run build --workspace=@tmjconnect/provider` → `apps/provider/dist/`
**Dev:** `npm run dev:provider` → Vite dev server on `:5174`
**Docker:** [apps/provider/Dockerfile](../apps/provider/Dockerfile) — builds in `node:20-alpine`, ships a `nginx:alpine` image whose sole purpose is to make `dist/` available to the main nginx container via a shared named volume.

**Why a separate image for a static bundle?** So the container registry stores a versioned artifact (`ghcr.io/your-org/tmjconnect-provider:1.1.0`). Rollbacks are a compose `image:` tag change, not a rebuild.

### 4. Admin portal (`apps/admin`)

- **What:** Internal operations SPA (user management, outbox monitor, audit log, system metrics).
- **Status:** Source lives on branch `adminPortal`, not yet merged to `main`. The `apps/admin/dist/` tree committed on main is a prebuilt artifact.
- **Merge path:** `git checkout adminPortal -- apps/admin/src` (pull sources into main) or `git merge adminPortal`.

### 5. Postgres 16

- **What:** Single primary database. Tables: users, profiles, provider_details, sessions, auth (tokens, codes, MFA), symptom_logs, reports, report_responses, report_requests, clinical_notes, exercises, exercise_assignments, exercise_completions, patient_provider_links, linking_codes, reminders, notifications, notification_outbox, notification_preferences, audit_logs, idempotency_keys, job_runs, rl_* (rate limiter).
- **Why:** Relational model fits PHI (referential integrity, foreign keys, triggers). Same engine in dev, test, and prod — no driver surprises.
- **How:** Accessed via Drizzle ORM. Schema is the source of truth in TypeScript (`apps/api/src/db/schema/*.ts`); migrations are hand-written SQL in `apps/api/drizzle/migrations/*.sql` to retain full control over triggers, indexes, and ALTERs.

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
  - **Multi-origin SPA routing.** One nginx, three hostnames (api, provider, admin), one cert-bot.
- **How:** See [docker/nginx.conf](../docker/nginx.conf). TLS cipher suite is fixed to TLS 1.2+ with HIPAA-aligned AEAD ciphers. CSP is distinct per SPA origin and whitelists the API origin + Google Fonts.

### 7. Certbot (Let's Encrypt)

- **What:** Automated TLS certificate issuance and renewal.
- **Why:** HIPAA requires encryption in transit. Let's Encrypt is free, automated, and universally trusted.
- **How:** Container runs `certbot renew` every 12 hours in a loop. First-time issuance is manual:
  ```
  docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
    -d api.tmjconnect.com -d provider.tmjconnect.com -d admin.tmjconnect.com
  docker compose exec nginx nginx -s reload
  ```

### 8. Storage

- **What:** File storage for avatars, exercise videos, report photos.
- **Why:** PHI content (photos on reports, patient-uploaded media).
- **How:** Abstracted via `StorageDriver` interface in [apps/api/src/services/storage.ts](../apps/api/src/services/storage.ts).
  - **Pilot:** `local` driver. Writes to `/data/uploads`, served by nginx at `/uploads/*`. Survives container restarts via named Docker volume.
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
| `UPLOAD_DIR` | Local storage path | Default `./uploads` |
| `S3_BUCKET` + `S3_REGION` + `CLOUDFRONT_URL` | S3 driver | Required if `STORAGE_DRIVER=s3` |
| `JWT_SECRET_PREVIOUS` | Key rotation grace period | Accepts tokens signed with old key for N hours |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` | Default `info` in prod |

### Where they live

| Environment | Source of vars |
|---|---|
| Local dev | [apps/api/.env](../apps/api/.env) — gitignored |
| Test | [apps/api/tests/helpers/testEnv.ts](../apps/api/tests/helpers/testEnv.ts) — hardcoded for deterministic tests |
| Staging | Secrets manager (AWS Secrets Manager / Doppler / Vault) → `.env` on server |
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
   cd apps/api && npx drizzle-kit migrate
   ```
4. **Apply to test DB** (separate port 5433):
   ```
   PGPASSWORD=test_password psql -h 127.0.0.1 -p 5433 -U tmjconnect -d tmjconnect_test \
     -f drizzle/migrations/NNNN_description.sql
   ```
5. **Update [API_CHANGELOG.md](API_CHANGELOG.md)** and [openapi.yaml](openapi.yaml) if endpoints changed.
6. **Apply to staging**, run smoke tests.
7. **Apply to production** during a low-traffic window. For destructive migrations, take a backup first.

### Safety rules

- **Backfill before enforcing.** If adding a `NOT NULL` column: first `ADD COLUMN` nullable, backfill data, then `ALTER COLUMN SET NOT NULL` in a follow-up migration.
- **Never drop columns in the same deploy that removes references.** Two-stage: deploy code that no longer reads/writes → wait one release → drop the column.
- **`audit_logs` is sacred.** The cleanupJob explicitly skips it (6-year HIPAA retention). Migrations must not truncate or re-shape it without an approved retention plan.

### Current migration count

0001–0007 applied. See [apps/api/drizzle/migrations/](../apps/api/drizzle/migrations/).

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

**In Docker**, logs go to stdout; docker-compose's json-file driver rotates at 10MB × 5 files. Ship to your log backend (Papertrail, Loki, CloudWatch) via a sidecar or Docker driver.

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

Docker's `HEALTHCHECK` directive hits this every 30s. Three consecutive failures mark the container unhealthy → nginx stops routing → orchestrator replaces it.

### Audit logs

Every PHI-touching route attaches `auditLog(action, resource_type)` middleware. On response finish, an `audit_logs` row is inserted with `user_id`, `action`, `resource_type`, `resource_id`, `ip_address`, `user_agent`, `metadata.requestId`, `statusCode`. Fire-and-forget — audit failures log to Sentry but never fail the request.

**Retention:** 6 years minimum (HIPAA). `cleanupJob` explicitly avoids this table.

---

## Local Development

### Prerequisites

- Node 20+, npm 10+
- Docker Desktop (for Postgres)
- `openssl` (to generate secrets once)

### First-time setup

```bash
# 1. Clone and install
git clone <repo> && cd tmjconnect
npm install

# 2. Start Postgres (dev + test DBs)
cd docker && docker compose -f docker-compose.dev.yml up -d
# → postgres on :5432 (dev db), postgres_test on :5433 (test db)

# 3. Generate local secrets (never commit)
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and fill in:
#   JWT_SECRET=$(openssl rand -base64 48)
#   JWT_REFRESH_SECRET=$(openssl rand -base64 48)
#   MFA_ENCRYPTION_KEY=$(openssl rand -hex 32)

# 4. Build shared package
npm run build --workspace=packages/shared

# 5. Run all migrations
cd apps/api && npx drizzle-kit migrate
# Same command against test DB:
DATABASE_URL=postgresql://tmjconnect:test_password@127.0.0.1:5433/tmjconnect_test \
  npx drizzle-kit migrate

# 6. Start API in dev mode (ts-node-dev, hot reload)
cd ../.. && npm run dev:api
# → http://localhost:3000
# → Swagger UI: http://localhost:3000/docs

# 7. Start provider portal
npm run dev:provider
# → http://localhost:5174
```

### Daily workflow

```bash
# Terminal 1: API
npm run dev:api

# Terminal 2: Provider (or admin)
npm run dev:provider

# Terminal 3: tests when you need them
cd apps/api && npx jest --watch
```

### Why a separate test DB

Integration tests truncate all tables between suites (`truncateAllTables()` in [tests/helpers/testContainer.ts](../apps/api/tests/helpers/testContainer.ts)). If tests shared the dev DB, you'd lose your dev data every `npm test`.

Dev DB on **5432**, test DB on **5433**. Both run in the `docker-compose.dev.yml` stack.

### Port map (dev)

| Port | Service |
|---|---|
| 3000 | API |
| 5174 | Provider portal (Vite) |
| 5173 | Admin portal (Vite) |
| 8081 | Patient app (Expo) |
| 5432 | Postgres (dev) |
| 5433 | Postgres (test) |

---

## Test

### Running tests

```bash
# Full suite (~3 min)
cd apps/api && npx jest --runInBand

# Single file
npx jest tests/integration/reports.test.ts

# Single test
npx jest -t "idempotent on Idempotency-Key replay"

# Watch mode
npx jest --watch
```

### Why `--runInBand`

Tests share a real Postgres instance. Running in parallel would race on `truncateAllTables`. `jest.config.ts` pins `maxWorkers: 1`.

### CI configuration

Example GitHub Actions:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: tmjconnect_test
          POSTGRES_USER: tmjconnect
          POSTGRES_PASSWORD: test_password
        ports: ['5433:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build --workspace=packages/shared
      - run: npx drizzle-kit migrate
        working-directory: apps/api
        env:
          DATABASE_URL: postgresql://tmjconnect:test_password@localhost:5433/tmjconnect_test
      - run: npx jest --runInBand --ci
        working-directory: apps/api
        env:
          TEST_DATABASE_URL: postgresql://tmjconnect:test_password@localhost:5433/tmjconnect_test
```

### Test database lifecycle

1. CI spins up a fresh Postgres container.
2. Run all migrations against it.
3. Tests truncate between describe blocks.
4. Container is destroyed at job end.

No migration rollback logic — we always migrate forward from an empty DB.

### Coverage targets

Current: 235 tests across 12 suites. Key surfaces covered:

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

Identical to production: same Docker Compose stack, same nginx config, same TLS, same Sentry integration — but:

- Smaller VPS (1–2 GB RAM is fine).
- Different secrets (mandatory; never reuse prod secrets).
- Subdomain: `api.staging.tmjconnect.com`, `provider.staging.tmjconnect.com`.
- `NODE_ENV=production` (staging runs as "production" for realistic behaviour).
- **Fake PHI only.** Use seeded synthetic data. Real PHI in staging is a HIPAA violation unless staging is BAA-covered.
- Separate Sentry project (`SENTRY_ENVIRONMENT=staging`).
- Separate Resend API key + sender domain (or use Resend test mode).

### Deploy flow

Same as production, but against the staging host. Usually wired as a GitHub Actions job that deploys on every push to `main`:

```yaml
deploy-staging:
  needs: test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to staging
      run: |
        ssh staging.tmjconnect.com "cd /opt/tmjconnect && \
          git pull && \
          docker compose pull && \
          docker compose up -d --no-deps api provider-frontend nginx && \
          docker compose exec -T api npx drizzle-kit migrate"
```

---

## Production (Pilot) — VPS + Docker Compose

### Target

25–50 concurrent users. Single-host deployment. HIPAA-aligned but not multi-region HA.

### Hardware

- **VPS:** 4 vCPU, 8 GB RAM, 80 GB SSD (Hetzner CX31 / DigitalOcean droplet / Linode).
- **Bandwidth:** 5 TB/month minimum (video uploads are heavy).
- **Region:** same region as majority of users (latency).
- **OS:** Ubuntu 22.04 LTS.
- **Backups:** enable daily VPS snapshots (provider-level) + nightly logical `pg_dump` to object storage.

### First-time host setup

```bash
# SSH in as a non-root admin user with sudo
ssh admin@tmjconnect-prod

# System packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw docker.io docker-compose-plugin git

# Firewall
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP (redirect to 443)
sudo ufw allow 443    # HTTPS
sudo ufw enable

# Docker group (avoids sudo for compose)
sudo usermod -aG docker $USER
# Log out and back in

# Clone repo
sudo mkdir -p /opt/tmjconnect && sudo chown $USER /opt/tmjconnect
git clone <repo> /opt/tmjconnect
cd /opt/tmjconnect

# Secrets — pull from your secrets manager and write to docker/.env
vim docker/.env
# Required keys: POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET,
#                MFA_ENCRYPTION_KEY, ALLOWED_ORIGINS, RESEND_API_KEY,
#                TWILIO_*, FIREBASE_*, SENTRY_DSN, APP_URL, API_URL.
chmod 600 docker/.env

# Build and start everything
cd docker
docker compose --env-file .env up -d

# One-time cert issuance (after DNS points to this host)
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d api.tmjconnect.com \
  -d provider.tmjconnect.com \
  -d admin.tmjconnect.com \
  --email ops@tmjconnect.com --agree-tos --no-eff-email

docker compose exec nginx nginx -s reload

# Apply migrations
docker compose exec api npx drizzle-kit migrate

# Smoke test
curl -fsS https://api.tmjconnect.com/health
curl -fsS https://provider.tmjconnect.com | head
```

### Rolling deploys

The compose stack doesn't do zero-downtime by itself — `docker compose up -d` recreates containers in sequence, which causes a brief (~2–5 s) nginx 502 while the API restarts. For pilot scale, acceptable; for stricter SLAs, see [Production (Scale)](#production-scale--aws-ecs--rds).

Typical deploy:

```bash
cd /opt/tmjconnect
git pull
docker compose build api provider-frontend
docker compose up -d --no-deps api provider-frontend nginx
docker compose exec api npx drizzle-kit migrate   # if new migrations
docker compose logs -f api | head -50              # sanity check
```

### Rollback

Docker Compose uses tagged images (`ghcr.io/your-org/tmjconnect-api:1.1.0`). To roll back:

```bash
# In docker/.env or docker-compose.yml, pin the previous tag:
#   image: ghcr.io/your-org/tmjconnect-api:1.0.0
docker compose pull api
docker compose up -d --no-deps api
```

For a bad migration: apply a **forward** reversal migration (new file, higher number, e.g. `0008_revert_0007_...`). Never `drizzle-kit drop` — it's destructive and breaks state tracking.

### Backups

**Postgres logical dump (nightly):**

```bash
# /opt/tmjconnect/scripts/backup-pg.sh
#!/bin/bash
set -euo pipefail
STAMP=$(date +%Y-%m-%d)
docker compose exec -T postgres pg_dump -U tmjconnect tmjconnect \
  | gzip > /opt/backups/tmjconnect-$STAMP.sql.gz

# Ship to object storage (rclone / aws s3 cp)
rclone copy /opt/backups/tmjconnect-$STAMP.sql.gz b2:tmjconnect-backups/

# Retention: keep 30 days
find /opt/backups -name 'tmjconnect-*.sql.gz' -mtime +30 -delete
```

Cron: `0 2 * * * /opt/tmjconnect/scripts/backup-pg.sh >> /var/log/pg-backup.log 2>&1`

**Uploads volume:** back up `/var/lib/docker/volumes/docker_uploads_data/_data` nightly to object storage.

**Restore drill:** every quarter. Restore to a throwaway VPS, verify data integrity, destroy. HIPAA auditors will ask.

### Why `uploads_data` mounts ro in nginx

Nginx serves files from the uploads volume read-only. The only writer is the API container. This makes it impossible for a misconfigured nginx directive to corrupt uploads.

### Certificate renewal

Certbot container runs `certbot renew` every 12 hours in a loop. Renewals auto-install into `/etc/letsencrypt/live/*`. Nginx picks them up on reload — add a monthly cron to force one:

```
0 3 1 * * docker compose -f /opt/tmjconnect/docker/docker-compose.yml exec nginx nginx -s reload
```

### Monitoring

Minimum viable:

1. **Uptime check** against `https://api.tmjconnect.com/health` (Upptime, UptimeRobot, Better Stack).
2. **Sentry alerts** on error rate spikes.
3. **Disk space alert** on the VPS (`df -h /var/lib/docker`).
4. **Certbot renewal failures** → email on `systemctl status certbot-renew`.

---

## Production (Scale) — AWS ECS + RDS

Once the pilot outgrows a single VPS (~500 users or >10 TB/month), move to AWS:

### Target topology

```
Route53 (DNS)
   │
   ▼
CloudFront (CDN)  ──── S3 (provider-dist bucket)
   │
   ▼
ALB (Application Load Balancer)  ──── ACM (TLS certs, auto-renewed)
   │
   ▼
ECS Fargate Service × N  ──── API containers (task definition from ECR image)
   │                              │
   │                              ├─► RDS Postgres 16 (Multi-AZ)
   │                              ├─► ElastiCache Redis (optional, for dashboard caching)
   │                              ├─► S3 (uploads)
   │                              └─► CloudFront (signed URL delivery)
```

### Migration path

1. **Extract secrets** into AWS Secrets Manager (one secret per `.env` variable).
2. **Create RDS** `db.t4g.medium` Multi-AZ. Restore the latest `pg_dump` from the pilot host.
3. **Push images** to ECR: `docker compose build api provider-frontend && docker tag ... && docker push ...`.
4. **Create ECS task definition** that references Secrets Manager ARNs for env vars.
5. **Provision ALB** with an ACM cert for `api.tmjconnect.com`.
6. **Put provider `dist/` on S3** + CloudFront. Invalidate on each deploy.
7. **Swap `STORAGE_DRIVER=s3`** and migrate uploads from the pilot VPS to the S3 bucket (`aws s3 sync`).
8. **Cut DNS** from the pilot VPS to ALB / CloudFront.
9. Run the pilot for another week in read-only mode (firewall-block writes) so you can fall back if needed. Then decommission.

### What changes in code: nothing

The API is environment-agnostic. The storage driver switch is an env var. The cron jobs use advisory locks and will safely run across N ECS tasks. The only operational change is deploying via ECS CI (`ecs-deploy` action) instead of `docker compose up -d`.

### What you gain

- Zero-downtime deploys (rolling ECS updates).
- Horizontal scaling (multiple API tasks behind ALB).
- Multi-AZ database failover.
- CloudFront edge caching for SPAs (faster global load).
- IAM-scoped access to every AWS service.

### What you lose

- Cost: ~$250/month baseline vs. ~$30/month for a pilot VPS.
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
9. `npx jest --runInBand` — all green.
10. Wire the frontend (if applicable): TanStack Query hook → component → RHF form.

### Rotating the JWT secret

```bash
# 1. Generate new secret
NEW=$(openssl rand -base64 48)

# 2. Update docker/.env:
#    JWT_SECRET_PREVIOUS=<current JWT_SECRET>
#    JWT_SECRET=$NEW

# 3. Rolling restart
docker compose up -d --no-deps api

# 4. Wait 24 hours. All tokens signed with the old secret have now expired
#    (access token TTL is 15 min; refresh token is rotated on every use).

# 5. Remove JWT_SECRET_PREVIOUS from docker/.env and restart again.
```

### Investigating a 500 spike

1. Check Sentry for the top error of the last 15 min.
2. Confirm the `requestId` on any affected log line.
3. Grep pino logs: `docker compose logs api | grep <requestId>`.
4. Cross-reference with `audit_logs.metadata.requestId` for what the user was doing.
5. Check `job_runs` — did a cron job fail and leave DB in a bad state?
6. Check RDS/Postgres metrics (connection count, lock waits).
7. If it's a regression from a recent deploy, roll back the image tag.

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

Env validator is doing its job. Check your `.env`:

```bash
node -e "console.log(process.env.MFA_ENCRYPTION_KEY?.length)"  # must be 64
```

Regenerate with `openssl rand -hex 32`.

### `Tests fail: "relation 'report_requests' does not exist"`

Migration 0007 not applied to test DB. See [Database Migrations](#database-migrations).

### `nginx: host not found in upstream "api:3000"`

API container isn't running or isn't on the `internal` network. `docker compose ps` → check state. `docker compose logs api` → check why it crashed.

### `Provider portal shows blank page, console has 404 on /assets/index-*.js`

Build artifact isn't in the `provider_dist` volume. Rebuild:

```bash
docker compose build provider-frontend
docker compose up -d provider-frontend
docker compose restart nginx
```

### `Let's Encrypt: rate limit exceeded`

Staging and prod share Let's Encrypt's rate limits per domain. Use the staging ACME endpoint for testing:

```
--server https://acme-staging-v02.api.letsencrypt.org/directory
```

Re-issue against prod once your nginx config is stable.

### `Postgres: too many connections`

Pool is misconfigured or a leak. `pgOpts` in [apps/api/src/config/database.ts](../apps/api/src/config/database.ts) caps at 20. Check `SELECT count(*) FROM pg_stat_activity WHERE datname='tmjconnect'`. If >> 20, you have multiple API instances; reconcile.

### `CORS errors in browser console`

`ALLOWED_ORIGINS` in `.env` doesn't include the origin hitting the API. Check exact scheme + host + port match. No trailing slashes.

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
- [ ] Sentry project created, DSN in `.env`, test event visible in dashboard
- [ ] Migrations applied (`drizzle-kit migrate`)
- [ ] Uptime check configured against `/health`
- [ ] `pg_dump` backup script + cron installed
- [ ] Uploads volume backup configured
- [ ] Firewall (`ufw`) only allows 22/80/443
- [ ] SSH: key-only auth, root login disabled
- [ ] Monitoring: disk space, Sentry rate, certbot renewal
- [ ] Admin user created (first provider account promoted to admin via SQL)
- [ ] Smoke tests pass: register, verify email, login, MFA, submit report

Once every box is checked, the pilot is live.
