# TMJConnect — System Architecture & Technical Design

**Version:** 3.0 | **Phase:** Phase 1 MVP | **Date:** April 2026

**AQION TECH × OROFACIAL — CONFIDENTIAL**

> Contains proprietary technical architecture. Distribution restricted to project stakeholders.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Principles](#3-architecture-principles)
4. [System Overview](#4-system-overview)
5. [Project Structure](#5-project-structure)
6. [Database Schema](#6-database-schema)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [API Route Map](#8-api-route-map)
9. [Notification System](#9-notification-system)
10. [File & Video Storage](#10-file--video-storage)
11. [Audit Logging](#11-audit-logging)
12. [Scheduled Jobs](#12-scheduled-jobs)
13. [Admin Dashboard](#13-admin-dashboard)
14. [Security & HIPAA Compliance](#14-security--hipaa-compliance)
15. [Error Handling Strategy](#15-error-handling-strategy)
16. [Deployment Strategy](#16-deployment-strategy)
17. [Non-Functional Requirements](#17-non-functional-requirements)
18. [Third-Party Services & BAA Chain](#18-third-party-services--baa-chain)
19. [Environment Variables](#19-environment-variables)
20. [Build Order — Sprint Plan](#20-build-order--sprint-plan)
21. [Testing Checklist](#21-testing-checklist)
22. [Decisions & Actions Required](#22-decisions--actions-required)
23. [Changelog from v2.0](#23-changelog-from-v20)

---

## 1. Executive Summary

TMJConnect is a HIPAA-compliant orofacial pain management platform. It consists of three client applications — a **Patient mobile app**, a **Provider web portal**, and an **Admin dashboard** — all backed by a single REST API. A static **landing page** completes the product surface.

The architecture is designed for a solo developer to build within 6–8 weeks, with a clear migration path from a Docker Compose VPS pilot (25–50 users) to a full AWS production environment (5,000+ users). The same codebase and Docker image runs in both environments; the only change between environments is configuration via environment variables.

### Guiding Principles

| Principle | Decision |
|---|---|
| **Simple first (KISS)** | No abstractions until they are needed. Plain Express.js routes, not enterprise service layers. Every module does one thing — no god files. |
| **One database** | PostgreSQL handles everything — no Redis, no message queues, no cache for pilot. |
| **Dual hosting** | VPS pilot → AWS production. Same codebase, different deployment configuration. |
| **HIPAA by default** | Encryption, audit logging, session management, and access controls are built into every layer from day one — not bolted on later. |
| **Fail loudly in dev** | Missing API keys cause console logging, not crashes. Production missing required vars causes immediate startup failure. |
| **No module depends on another** | Modules (routes, services, jobs) are self-contained. Dependencies are injected via the DI container — never imported directly. A module can be deleted without breaking unrelated code. |
| **Idempotent by design** | Critical write operations (report submission, exercise completion, linking acceptance) are safe to retry. Natural deduplication or idempotency keys prevent duplicates. |
| **Observable by default** | Structured JSON logs, request-level tracing, and health metrics are built in — not added after the first outage. |

---

## 2. Technology Stack

Every technology was selected for simplicity, ecosystem size, and solo-developer productivity.

### Backend

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | LTS, widely supported, great TypeScript story |
| Framework | Express.js + TypeScript | 4.x | Most widely known Node.js framework. Huge ecosystem. Easy to debug. No NestJS. No Hapi. |
| ORM | Drizzle ORM | 0.x | SQL-first TypeScript ORM. No magic. Generated SQL is always inspectable. Type-safe queries without hiding PostgreSQL behaviour. |
| Database driver | `pg` | 8.x | Underlying PostgreSQL driver used by Drizzle. |
| Logging | pino + pino-http | 9.x | Structured JSON logging. `pino-pretty` for dev. `pino-http` for request logging. |
| Sanitisation | isomorphic-dompurify | 13.x | Server-side HTML sanitisation for free-text fields. Prevents stored XSS. |
| Validation | Zod | 3.x | TypeScript-first schema validation. Used for env vars, request bodies, query params, route params. |
| Password hashing | bcryptjs | 2.x | 12 salt rounds. Pure JS — no native bindings. |
| JWT | jsonwebtoken | 9.x | Access token signing and verification. |
| TOTP (MFA) | otpauth | 9.x | TOTP secret generation and code verification. |
| Email | Resend | 3.x | Modern API. Great DX. Free tier covers pilot. |
| SMS | Twilio | 5.x | Simple REST API. Reliable for MFA codes. |
| Push | Firebase Admin SDK | 12.x | FCM for iOS (APNs) and Android from server. |
| Scheduled jobs | node-cron | 3.x | Lightweight cron inside the Node process. |
| File uploads | multer | 1.x | Multipart form data parsing with size and MIME validation. |
| HTTP security | helmet | 7.x | Sets all standard security response headers. |
| Rate limiting | express-rate-limit | 7.x | Per-IP rate limiting. Three tiers: general, auth, MFA. Uses `@express-rate-limit/pg` PostgreSQL store — rate limit state survives deploys and restarts. |
| Rate limit store | @express-rate-limit/pg | 1.x | PostgreSQL-backed store for express-rate-limit. Ensures rate limit counters persist across process restarts — a determined attacker cannot bypass limits by waiting for a deploy. |
| CORS | cors | 2.x | Whitelist-based origin checking. |
| Process manager | PM2 | 5.x | Pilot process management and restart policy. |

### Frontend

| App | Technology | Notes |
|---|---|---|
| Patient mobile app | Expo (React Native) | Managed workflow. OTA updates. No Xcode/Gradle wrestling for 90% of features. |
| Provider portal | React + Vite (TypeScript) | Fast builds. SPA. |
| Admin dashboard | React + Vite (TypeScript) | Same stack as portal. Separate deploy. Role-gated routes. |
| Landing page | React + Vite (TypeScript) | Static export. |

---

## 3. Architecture Principles

These principles are enforced throughout the codebase. Deviating from them requires explicit justification.

### 3.1 SOLID Principles Applied

**Single Responsibility**
Each module has exactly one reason to change. A route file handles HTTP concerns only. A Drizzle schema file defines table structure only. A service file wraps one external integration only. Mixing these is a code smell.

**Open/Closed**
The storage abstraction is the key example. `storage.ts` defines a `StorageDriver` interface. The `local` and `s3` drivers implement it. Adding a new driver (e.g. GCS) means adding a new file — not modifying existing code. The same pattern applies to the notification dispatcher: adding a new channel adds a new service — it does not change `notify.ts`.

**Liskov Substitution**
The `local` and `s3` storage drivers are interchangeable. Any code that calls `storage.upload()` does not know or care which driver is active. Swapping drivers does not change the calling code.

**Interface Segregation**
`StorageDriver` exposes only `upload`, `getUrl`, and `delete`. Clients that only need `getUrl` are not forced to depend on `upload`. Notification services expose only `send`. External service wrappers do not expose internal SDK details.

**Dependency Inversion**
Route handlers depend on the `StorageDriver` interface abstraction, not the `LocalDriver` or `S3Driver` concrete implementations. The active driver is resolved once at startup from the `STORAGE_DRIVER` environment variable and injected where needed. This pattern is generalised through a lightweight DI container (see Section 3.3).

### 3.2 Coding Principles

1. **No module imports another module directly.** Route handlers receive their dependencies (db, services, logger) from the DI container — never via top-level `import`. This keeps every module self-contained and independently testable. No dependency injection *framework* — just a plain object wired at startup.
2. **Drizzle for all database access.** Write all queries using Drizzle's query builder. Never use raw string interpolation. For complex queries that Drizzle cannot express cleanly, use Drizzle's `sql` tagged template helper with bound parameters — never raw string concatenation.
3. **Reused queries live in `db/queries/`.** If a query is called from more than one route file, extract it to the corresponding `db/queries/` file as a typed function. Otherwise, keep it inline in the route file.
4. **Services are for external integrations ONLY.** `email.ts`, `sms.ts`, `push.ts`, `storage.ts`, `notify.ts`. No business logic belongs in services. Each service exposes a simple interface and is registered in the DI container.
5. **Every route that touches PHI gets an audit log entry.** Applied as per-route middleware, never manually inside a handler.
6. **Stubs in development.** Every external service (email, SMS, push) checks for its credentials at startup. If missing, it logs to console instead of crashing. Production startup fails fast if required vars are absent. In tests, services are replaced with in-memory stubs via the DI container.
7. **Fail fast on startup.** `env.ts` validates all environment variables with Zod before the server starts. A missing `DATABASE_URL` or `JWT_SECRET` must crash the process immediately with a clear message — not fail silently at request time.
8. **Never leak internals.** Stack traces, SQL errors, and internal details are never returned in API responses in production. All errors are converted to safe `AppError` messages in the global error handler.
9. **Consistent error responses.** Every error response has the same shape: `{ error: { code: string, message: string, details?: unknown } }`.
10. **No magic numbers.** Constants like token expiry durations, rate limit windows, and bcrypt rounds are defined in `config/constants.ts`, not scattered inline.
11. **Sanitise all free-text input.** All user-provided free-text fields (symptom notes, report descriptions, messages) are sanitised before storage to strip HTML/script tags. Validation (Zod) checks shape; sanitisation prevents stored XSS.
12. **Idempotent write operations.** Critical POST endpoints accept an optional `Idempotency-Key` header or use natural deduplication to prevent duplicate records from retries or double-taps.
13. **Structured logging everywhere.** All application logs are JSON via `pino`. No `console.log` in production code. Every log entry includes `requestId`, `level`, and `timestamp`.

### 3.3 Dependency Injection Pattern

The DI pattern ensures no module depends on any other module directly. Dependencies are wired once at startup in `config/container.ts` and passed down.

```typescript
// config/container.ts — the only file that knows about concrete implementations.
import { createDb } from './database';
import { createEmailService } from '../services/email';
import { createSmsService } from '../services/sms';
import { createPushService } from '../services/push';
import { createStorageDriver } from '../services/storage';
import { createNotifyService } from '../services/notify';
import { createLogger } from './logger';
import { env } from './env';

export function createContainer() {
  const logger = createLogger(env.NODE_ENV, env.LOG_LEVEL);
  const db = createDb(env.DATABASE_URL);
  const email = createEmailService(env, logger);
  const sms = createSmsService(env, logger);
  const push = createPushService(env, logger);
  const storage = createStorageDriver(env);
  const notify = createNotifyService({ email, sms, push, db, logger });

  return { db, email, sms, push, storage, notify, logger, env };
}

export type Container = ReturnType<typeof createContainer>;
```

**How routes consume it:**
```typescript
// routes/symptoms.ts — receives container, never imports services directly.
export function symptomsRouter(container: Container) {
  const router = Router();
  const { db, notify, logger } = container;
  // All handlers use db, notify, logger from the closure — not from imports.
  return router;
}
```

**Rules:**
- `container.ts` is the only file that imports concrete service implementations.
- Route files, middleware, and jobs receive the container (or a subset of it) as an argument.
- In tests, create a test container with in-memory stubs — no mocking libraries needed.
- No runtime DI framework (`tsyringe`, `inversify`, etc.). The container is a plain object.

### 3.4 Idempotency

Network retries and double-taps must not create duplicate data. Two strategies are used depending on the operation:

**Strategy 1 — Natural deduplication (preferred):**
Use database constraints to make duplicate writes impossible. Already applied to:
- `exercise_completions`: unique index on `(assignment_id, patient_id, DATE(completed_at))`.
- `patient_provider_links`: partial unique index on `(patient_id, provider_id) WHERE unlinked_at IS NULL`.

Extend this pattern to:
- `symptom_logs`: unique index on `(patient_id, DATE(logged_at))` — one log entry per patient per day. Subsequent submissions on the same day update the existing row via `ON CONFLICT DO UPDATE`.
- `linking/accept`: check link existence before insert — return `200` with existing link if already accepted.

**Strategy 2 — Idempotency-Key header (for non-naturally-unique operations):**
Critical POST endpoints (`/patients/me/reports`, `/providers/reports/:id/respond`) accept an optional `Idempotency-Key` header (client-generated UUID). The server stores the key + response in a lightweight `idempotency_keys` table:

| Column | Type | Notes |
|---|---|---|
| key | VARCHAR(64) PK | Client-provided idempotency key. |
| response_status | INT NOT NULL | HTTP status code of the original response. |
| response_body | JSONB NOT NULL | **Stores only `{ status, resourceId }` — never the full response body.** Prevents uncontrolled PHI copies. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| expires_at | TIMESTAMPTZ NOT NULL | 24-hour expiry. Cleaned up by `codeExpiryJob`. |

If the same key is sent again within 24 hours, the server returns the stored status code and re-fetches the resource by `resourceId` through the normal code path (applying `scopeToUser()` and all access controls). Keys expire after 24 hours and are cleaned up by the existing `codeExpiryJob`.

### 3.5 Input Sanitisation

Zod validates *shape* (types, required fields, string lengths). Sanitisation prevents *content* attacks (stored XSS). Both run on every request — validation first, then sanitisation.

**Implementation:** A `sanitise` utility function using `DOMPurify` (via `isomorphic-dompurify`) strips all HTML tags and attributes from free-text string fields. It is applied inside the `validate` middleware after Zod parsing succeeds:

```typescript
// middleware/validate.ts
import { sanitise } from '../utils/sanitise';

// After Zod parse:
const parsed = schema.parse(req.body);
const sanitised = sanitiseObject(parsed, ['notes', 'description', 'message', 'patient_notes', 'internal_notes', 'instructions']);
req.body = sanitised;
```

**Fields sanitised:** `symptom_logs.notes`, `reports.description`, `reports.patient_notes`, `report_responses.message`, `report_responses.internal_notes`, `exercises.instructions`, `exercises.description`. These are the only free-text fields that accept user-generated content.

**Output encoding:** React and React Native auto-escape rendered content by default (no `dangerouslySetInnerHTML`). The provider portal must never render raw HTML from API responses. All text from the API is treated as plain text on the client.

### 3.6 Structured Logging

All application logs are structured JSON via `pino`. No `console.log` in production code. In development, `pino-pretty` formats logs for human readability.

```typescript
// config/logger.ts
import pino from 'pino';

export function createLogger(nodeEnv: string, level: string) {
  return pino({
    level,
    transport: nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
    redact: ['req.headers.authorization', 'req.body.password', 'req.body.code', 'req.body.token'],
    serializers: { req: pino.stdSerializers.req, res: pino.stdSerializers.res },
  });
}
```

**Log levels used:**
| Level | When |
|---|---|
| `error` | Unhandled exceptions, database connection failures, external service 5xx responses. |
| `warn` | Rate limit hits, failed login attempts, deprecated endpoint usage, external service timeouts. |
| `info` | Request completed (method, path, status, duration), job started/completed, deployment events. |
| `debug` | SQL queries (dev only), notification dispatch details, token rotation events. |

**Request logging middleware:** Every request is logged at `info` level on completion with: `method`, `url`, `statusCode`, `responseTime`, `requestId`, `userId` (if authenticated). Implemented via `pino-http` middleware registered before all route handlers.

**Correlation:** Every log entry includes `requestId` from the `X-Request-ID` header (Section 15.1). This ties application logs → audit entries → Sentry events into a single traceable chain.

**HIPAA constraint:** The `redact` option in pino config strips `password`, `code`, `token`, and `authorization` from all log output. PHI values (e.g. `notes`, `description`) must never be passed to the logger.

### 3.7 Testability by Design

The DI container is the foundation of testability. Every external dependency (database, email, SMS, push, storage) can be replaced with an in-memory stub by constructing a test container.

**Test database lifecycle:**
1. Tests run against a dedicated `tmjconnect_test` PostgreSQL database (separate from dev).
2. Before each test suite: `drizzle-kit migrate` applies all migrations to the test DB.
3. Before each test: truncate all tables (fast, no schema rebuild).
4. After all tests: drop the test database (CI cleanup).

**Test container factory:**
```typescript
// tests/helpers/testContainer.ts
export function createTestContainer(overrides?: Partial<Container>): Container {
  return {
    db: testDb,                    // Real Drizzle instance against test DB
    email: createStubEmail(),       // Logs sends to an in-memory array
    sms: createStubSms(),           // Logs sends to an in-memory array
    push: createStubPush(),         // No-op
    storage: createStubStorage(),   // In-memory file map
    notify: createStubNotify(),     // Calls stub email/sms/push
    logger: pino({ level: 'silent' }),
    env: testEnv,
    ...overrides,
  };
}
```

**Test patterns:**
- **Unit tests:** Test individual utility functions (`hash.ts`, `jwt.ts`, `pagination.ts`) — no container needed.
- **Integration tests:** Create a test container, mount routes, send HTTP requests via `supertest`. Assert responses + database state + stub service call counts.
- **No mocking libraries.** Stubs are plain objects that implement the same interface as real services. The DI container makes mocking libraries (sinon, jest.mock) unnecessary.

**Test data factories:**
A `tests/helpers/factories.ts` file exports functions like `createTestUser()`, `createTestProvider()`, `createTestSymptomLog()` that insert records with sensible defaults. Every factory returns the inserted record for assertions.

### 3.8 Graceful Degradation

When external dependencies fail, the API degrades gracefully instead of cascading failures to the client.

| Dependency Failure | Behaviour | User Impact |
|---|---|---|
| **Resend (email) down** | `notify()` logs error to Sentry, continues. In-app notification still created. | User misses email but sees in-app notification. |
| **Twilio (SMS) down** | MFA SMS fallback fails. TOTP and backup codes still work. | Provider uses authenticator app or backup code instead. |
| **Firebase (push) down** | Push delivery fails silently. In-app notification still created. | User misses push but sees notification in-app. |
| **Sentry down** | Errors logged locally via pino. No crash. | Zero user impact. Ops loses remote error visibility. |
| **Database pool exhausted** | New requests get `503 Service Unavailable` from health check. Connection queue with 30s timeout. | Brief delay or 503 for affected requests. |
| **Storage (S3/local) down** | Upload endpoints return `503`. All read paths return cached URLs. | Uploads temporarily unavailable. Existing files still accessible. |

**Circuit breaker on external services:** Each external service wrapper (`email.ts`, `sms.ts`, `push.ts`) tracks consecutive failure counts. After **5 consecutive failures**, the breaker opens and the service skips all calls for **60 seconds**, returning immediately with a logged warning. After 60 seconds the breaker enters half-open state — the next call is attempted, and on success the counter resets. This prevents cascading timeouts when a third-party service is down (e.g. 200 digest emails all timing out against a dead Resend API). Failure counts are in-process memory — a deploy resets them, which is acceptable.

**Database pool configuration** is specified in Section 6.1 (Migration Tooling) with explicit pool sizing.

**Startup dependency check:** On boot, the API verifies connectivity to PostgreSQL and logs warnings for unreachable external services. The server starts even if email/SMS/push are unreachable — it does not block on optional dependencies. Only `DATABASE_URL` connectivity is mandatory for startup.

### 3.9 Row-Level Access Control (Scoped Queries)

One missed `WHERE patient_id = req.user.id` leaks PHI. Instead of trusting every route handler to remember the ownership filter, a `scopedQuery` helper auto-injects it based on the authenticated user's role.

```typescript
// utils/scopedQuery.ts
import { eq, and, SQL } from 'drizzle-orm';

export function scopeToUser(baseCondition: SQL | undefined, table: { patient_id?: any; user_id?: any; provider_id?: any }, user: { id: string; role: string }): SQL {
  const ownerColumn =
    user.role === 'patient' ? (table.patient_id ?? table.user_id) :
    user.role === 'provider' ? (table.provider_id ?? table.user_id) :
    undefined; // admin — no scope filter

  if (!ownerColumn) return baseCondition ?? sql`TRUE`;
  const scopeFilter = eq(ownerColumn, user.id);
  return baseCondition ? and(baseCondition, scopeFilter)! : scopeFilter;
}
```

**How it's used in routes:**
```typescript
// routes/symptoms.ts — patient can only see their own symptom logs
const logs = await db.select()
  .from(symptomLogs)
  .where(scopeToUser(undefined, symptomLogs, req.user))
  .orderBy(desc(symptomLogs.loggedAt))
  .limit(limit).offset(offset);
```

**Rules:**
- Every query that touches PHI tables (`symptom_logs`, `reports`, `report_responses`, `exercise_assignments`, `exercise_completions`, `notifications`) **must** use `scopeToUser()` unless the route is admin-only.
- For providers viewing linked patients, the scope check is a two-step: first verify the patient is linked to the provider via `patient_provider_links WHERE unlinked_at IS NULL`, then query the patient's data.
- `scopeToUser()` is available via the DI container. It is tested in integration tests to verify that patient A cannot see patient B's data.
- Admin routes bypass the scope filter — `scopeToUser()` returns no filter for `role === 'admin'`.

---

## 4. System Overview

### 4.1 How It All Connects

The system is intentionally flat. Three client apps talk to one API server. The API talks to one database and a small number of external services.

```
Patient App (Expo)        →  HTTPS  →  Express API  →  PostgreSQL 16
Provider Portal (React)   →  HTTPS  →  Express API  →  PostgreSQL 16
Admin Dashboard (React)   →  HTTPS  →  Express API  →  PostgreSQL 16

Express API  →  Resend        (transactional email)
Express API  →  Twilio        (SMS: MFA codes + urgent alerts)
Express API  →  Firebase FCM  (push: iOS + Android)
Express API  →  Local disk    (files: pilot)
Express API  →  AWS S3        (files: production)
```

There are no microservices. There are no message queues. There is no cache layer. One process, one database, external services as needed.

### 4.2 What Runs Where

| Component | Pilot (VPS) | Production (AWS) |
|---|---|---|
| Express API | Docker container on VPS | ECS Fargate or EC2 |
| PostgreSQL | Docker container on VPS | RDS PostgreSQL Multi-AZ |
| File storage | Local disk + Nginx | S3 + CloudFront (signed URLs) |
| Reverse proxy / SSL | Nginx + Let's Encrypt | ALB + ACM certificate |
| Provider portal | Nginx static files | S3 + CloudFront |
| Admin dashboard | Nginx static files | S3 + CloudFront |
| Landing page | Nginx static files | S3 + CloudFront |
| Process manager | PM2 inside Docker | ECS task management |
| DNS | Cloudflare | Route 53 |

---

## 5. Project Structure

### 5.1 Monorepo Layout

```
tmjconnect/
├── apps/
│   ├── api/                              # Express.js backend (TypeScript)
│   ├── mobile/                           # Expo React Native patient app
│   ├── portal/                           # Provider web portal (React + Vite)
│   ├── admin/                            # Admin dashboard (React + Vite)
│   └── landing/                          # Marketing landing page
├── packages/
│   ├── shared/                           # Shared TypeScript types, Zod schemas, API contract types
│   └── ui/                               # Shared React components (portal + admin)
├── docker/
│   ├── docker-compose.yml                # Production-like: api + postgres + nginx
│   ├── docker-compose.dev.yml            # Dev: postgres only
│   ├── nginx.conf                        # Reverse proxy + SSL + static file serving
│   └── .env.example
└── package.json                          # Root workspace config
```

### 5.2 API Structure (`apps/api/`)

```
apps/api/
├── src/
│   ├── index.ts                          # Express app setup, middleware chain, route mounting
│   ├── config/
│   │   ├── env.ts                        # Zod-validated environment variables. Fail fast on startup.
│   │   ├── constants.ts                  # Named constants: token TTLs, bcrypt rounds, rate limit windows
│   │   ├── database.ts                   # Drizzle client initialisation + connection pool config
│   │   ├── container.ts                  # DI container: wires all services, db, logger at startup
│   │   └── logger.ts                     # pino structured logger factory
│   ├── middleware/
│   │   ├── errorHandler.ts               # AppError class + global error handler
│   │   ├── rateLimiter.ts                # Three rate limit tiers: general, auth, mfa
│   │   ├── auth.ts                       # authenticate(), authorize(), checkSessionTimeout()
│   │   ├── audit.ts                      # auditLog() middleware — fire-and-forget INSERT
│   │   ├── validate.ts                   # Zod validation + sanitisation middleware for body/query/params
│   │   ├── requestLogger.ts              # pino-http request logging middleware (method, path, status, duration, requestId)
│   │   └── requestTimeout.ts             # 30-second request timeout — aborts with 408 if handler exceeds deadline
│   ├── routes/
│   │   ├── auth.ts                       # Registration, login, email verify, MFA, refresh, reset, logout
│   │   ├── patients.ts                   # Patient profile, sessions
│   │   ├── providers.ts                  # Provider profile, patient list, patient detail, sessions
│   │   ├── exercises.ts                  # Exercise CRUD, assignments, completions
│   │   ├── symptoms.ts                   # Symptom logging, history, calendar
│   │   ├── reports.ts                    # Report submission, inbox, responses, flagging
│   │   ├── linking.ts                    # Invite code generation, acceptance, disconnection
│   │   ├── notifications.ts              # Notification list, mark read, preferences
│   │   ├── reminders.ts                  # Reminder CRUD
│   │   ├── uploads.ts                    # File/video upload endpoints
│   │   └── admin.ts                      # User management, audit logs, stats, login events
│   ├── db/
│   │   ├── schema/
│   │   │   ├── users.ts                  # users, profiles, provider_details table definitions
│   │   │   ├── auth.ts                   # refresh_tokens, sessions, mfa_backup_codes, password_resets
│   │   │   ├── linking.ts                # linking_codes, patient_provider_links
│   │   │   ├── exercises.ts              # exercises, exercise_assignments, exercise_completions
│   │   │   ├── clinical.ts               # symptom_logs, reports, report_responses
│   │   │   ├── notifications.ts          # notifications, notification_preferences, reminders
│   │   │   ├── system.ts                 # audit_logs, login_events, idempotency_keys
│   │   │   └── index.ts                  # Re-exports all schema objects
│   │   └── queries/
│   │       ├── auth.queries.ts           # Reused Drizzle queries across auth routes
│   │       ├── patients.queries.ts       # Reused Drizzle queries across patient routes
│   │       ├── providers.queries.ts      # Reused Drizzle queries across provider routes
│   │       ├── exercises.queries.ts      # Reused Drizzle queries across exercise routes
│   │       ├── symptoms.queries.ts       # Reused Drizzle queries across symptom routes
│   │       ├── reports.queries.ts        # Reused Drizzle queries across report routes
│   │       └── admin.queries.ts          # Reused Drizzle queries across admin routes
│   ├── services/
│   │   ├── email.ts                      # Resend wrapper + HTML email templates
│   │   ├── sms.ts                        # Twilio wrapper + SMS message builders
│   │   ├── push.ts                       # Firebase FCM wrapper
│   │   ├── storage.ts                    # Storage abstraction: StorageDriver interface + local/S3 drivers
│   │   └── notify.ts                     # Unified dispatcher: calls email/sms/push based on type + prefs
│   ├── jobs/
│   │   ├── index.ts                      # Registers and starts all cron jobs
│   │   ├── reminderJob.ts                # Fires exercise/symptom reminders (every minute)
│   │   ├── codeExpiryJob.ts              # Expires stale linking codes (every hour)
│   │   ├── weeklyDigestJob.ts            # Weekly patient summary email (Sunday 6 PM local)
│   │   ├── cleanupJob.ts                 # Anonymises and hard-deletes old soft-deleted accounts (3 AM daily)
│   │   └── orphanFileCleanupJob.ts        # Removes unreferenced upload files older than 7 days (4 AM daily)
│   ├── types/
│   │   ├── express.d.ts                  # Augments Express Request with req.user
│   │   └── schemas.ts                    # All Zod schemas (request validation + inferred types)
│   └── utils/
│       ├── jwt.ts                        # signAccessToken(), signRefreshToken(), verifyToken()
│       ├── hash.ts                       # hashPassword(), comparePassword(), hashToken(), generateCode()
│       ├── sanitise.ts                   # DOMPurify-based HTML stripping for free-text fields
│       ├── scopedQuery.ts                # Row-level access control: auto-injects ownership WHERE clauses
│       └── pagination.ts                 # parsePagination() — page/limit/offset from query params
├── tests/
│   ├── helpers/
│   │   ├── testContainer.ts              # Test DI container with in-memory stubs
│   │   └── factories.ts                  # Test data factories: createTestUser(), createTestProvider(), etc.
│   ├── integration/                      # supertest-based route tests against test DB
│   └── unit/                             # Pure function tests (utils, validators)
├── drizzle/
│   ├── migrations/                       # Auto-generated SQL migration files (drizzle-kit generate)
│   └── meta/                             # Drizzle migration metadata (do not edit manually)
├── drizzle.config.ts                     # drizzle-kit config: schema path, migrations path, db credentials
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

**Why `db/queries/` exists separately:** Any Drizzle query called from more than one route file is extracted to the matching `db/queries/` file as a typed function. Queries used by exactly one route stay inline in that route file. This prevents duplication without adding an abstraction layer.

**Why `db/schema/` is split by domain:** Each domain's tables are defined in their own schema file. This matches the Single Responsibility principle — a change to notification tables touches only `db/schema/notifications.ts`. All schema files are re-exported from `db/schema/index.ts` for use throughout the codebase.

**Why Drizzle for migrations:** `drizzle-kit generate` diffs the current schema files against the last snapshot and produces a new numbered SQL migration file automatically. `drizzle-kit migrate` applies pending migrations and tracks applied versions in the `__drizzle_migrations` table. No custom migration runner needed. Migrations are always inspectable plain SQL files in `drizzle/migrations/`.

### 5.3 Contract-First API Types (`packages/shared/`)

The `packages/shared` workspace package is the single source of truth for the API contract between backend and frontend. It contains:

```
packages/shared/
├── src/
│   ├── schemas/
│   │   ├── auth.schemas.ts               # Zod schemas for auth request/response bodies
│   │   ├── patients.schemas.ts           # Zod schemas for patient endpoints
│   │   ├── providers.schemas.ts          # Zod schemas for provider endpoints
│   │   ├── exercises.schemas.ts          # Zod schemas for exercise endpoints
│   │   ├── symptoms.schemas.ts           # Zod schemas for symptom endpoints
│   │   ├── reports.schemas.ts            # Zod schemas for report endpoints
│   │   ├── linking.schemas.ts            # Zod schemas for linking endpoints
│   │   ├── notifications.schemas.ts      # Zod schemas for notification endpoints
│   │   └── admin.schemas.ts              # Zod schemas for admin endpoints
│   ├── types/
│   │   └── index.ts                      # Inferred TypeScript types from all Zod schemas
│   ├── constants/
│   │   └── index.ts                      # Shared constants: roles, notification types, enums
│   └── index.ts                          # Re-exports all schemas, types, and constants
├── package.json
└── tsconfig.json
```

**How it works:**
1. Every Zod request/response schema is defined once in `packages/shared/src/schemas/`.
2. TypeScript types are inferred using `z.infer<typeof schema>` and exported from `types/index.ts`.
3. The API (`apps/api`) imports schemas for request validation in `validate()` middleware.
4. Frontend apps (`apps/mobile`, `apps/portal`, `apps/admin`) import the same types for type-safe API calls.
5. When an API shape changes, the shared schema changes too — and TypeScript compilation fails in any frontend that uses the old shape.

**Rules:**
- `packages/shared` has zero runtime dependencies other than Zod.
- It never imports from `apps/api`, `apps/mobile`, or any other app.
- All enums (`role`, `urgency`, `report_status`, `reminder_type`) are defined here once — not duplicated across apps.
- Shared schemas are a subset of the API's internal validation: they define the *contract* (what goes over the wire), not internal database-level logic.

---

## 6. Database Schema

PostgreSQL 16. All primary keys are `UUID` via `uuid_generate_v4()`. All timestamps are `TIMESTAMPTZ` (UTC). Required extensions: `uuid-ossp`, `pgcrypto`. An `updatedAt` column with an auto-update trigger is defined on every table that tracks changes.

Schemas are defined in TypeScript using Drizzle's schema DSL (`drizzle-orm/pg-core`). The canonical source of truth is the `src/db/schema/` files — not raw SQL. Migrations are generated from schema diffs via `drizzle-kit generate` and applied via `drizzle-kit migrate`. Migration files are plain SQL and are committed to the repository.

### 6.1 Migration Tooling & Connection Pool

**Connection pool configuration** (`config/database.ts`):

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';

export function createDb(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,                // Maximum connections in pool (pilot: 10, production: 20)
    idleTimeoutMillis: 30000,  // Close idle connections after 30s
    connectionTimeoutMillis: 5000,  // Fail if connection not acquired within 5s
  });
  return drizzle(pool, { schema });
}
```

| Setting | Pilot | Production | Rationale |
|---|---|---|---|
| `max` | 10 | 20 | Pilot has one process. Production ECS tasks share RDS `max_connections`. |
| `idleTimeoutMillis` | 30000 | 30000 | Release idle connections back to the pool promptly. |
| `connectionTimeoutMillis` | 5000 | 5000 | Fail fast if pool is exhausted — return 503 to client rather than hang. |

**Migration tooling** (`drizzle.config.ts`):

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import { env } from './src/config/env';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: env.DATABASE_URL },
});
```

### 6.1.1 Idempotency Keys Table

**`idempotency_keys`** — Stores responses for idempotent POST requests (Section 3.4).

| Column | Type | Notes |
|---|---|---|
| key | VARCHAR(64) PK | Client-provided `Idempotency-Key` header value. |
| response_status | INT NOT NULL | HTTP status code of the original response. |
| response_body | JSONB NOT NULL | **Stores only `{ status, resourceId }` — never the full response body.** See Section 3.4 for PHI rationale. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| expires_at | TIMESTAMPTZ NOT NULL | 24-hour expiry. Cleaned up by `codeExpiryJob`. |
```

**Commands:**
- `drizzle-kit generate` — diff schema files and produce a new SQL migration file
- `drizzle-kit migrate` — apply all pending migrations to the database
- `drizzle-kit studio` — local Drizzle Studio GUI for inspecting data during development

Migration history is tracked by Drizzle in the `__drizzle_migrations` table. Manual edits to generated migration files are permitted but must be reviewed carefully — they are irreversible once applied to production.

### 6.1.2 Migration Rollback Strategy

Drizzle does not generate down-migrations. The rollback strategy is **fix-forward**:

1. **Before every deploy:** Run `pg_dump --no-data --schema-only` to capture the current schema as a snapshot. Store alongside the migration in `drizzle/snapshots/`. This is automated in the GitHub Actions deploy step.
2. **On migration failure:** The new migration runs inside a transaction (Drizzle default). If it fails, PostgreSQL auto-rolls back — no manual intervention.
3. **On post-deploy regression:** Write a new forward migration that reverses the change. This is preferred over restoring a snapshot because forward migrations preserve data.
4. **Emergency rollback (last resort):** Restore the pre-deploy `pg_dump` snapshot to a recovery database, verify integrity, then swap. This loses all data written since deploy. Use only when a forward migration is impossible.

No down-migration tooling (e.g. `drizzle-kit rollback`) exists — the fix-forward approach avoids the risk of buggy down-migrations deleting production data.

### 6.2 Users & Auth Tables

**`users`** — All accounts: patients, providers, admins.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `uuid_generate_v4()` |
| email | VARCHAR(255) UNIQUE NOT NULL | Lowercase. Unique index. |
| password_hash | VARCHAR(255) NOT NULL | bcrypt. Never stored plain. |
| role | ENUM('patient','provider','admin') NOT NULL | |
| phone | VARCHAR(20) | Nullable. Required for SMS MFA. |
| email_verified | BOOLEAN DEFAULT FALSE | Must be true before any token is issued. |
| email_verify_code | VARCHAR(6) | 6-digit code. Cleared after use. |
| email_verify_expires | TIMESTAMPTZ | 24-hour expiry. |
| mfa_secret | TEXT | TOTP base32 secret. **Encrypted at rest** with AES-256-GCM using `MFA_ENCRYPTION_KEY` before storage. Decrypted only during TOTP verification. Nullable. |
| mfa_enabled | BOOLEAN DEFAULT FALSE | Providers: must be true before full tokens issued. |
| is_active | BOOLEAN DEFAULT TRUE | Set false to deactivate. |
| fcm_token | TEXT | Updated by client on login. Used for push. |
| tos_accepted_at | TIMESTAMPTZ | Nullable. |
| tos_version | VARCHAR(10) | Nullable. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | Auto-updated via trigger. |
| deleted_at | TIMESTAMPTZ | Soft delete. NULL = active. |

**`profiles`** — Extended user info.

| Column | Type | Notes |
|---|---|---|
| user_id | UUID PK, FK → users(id) ON DELETE CASCADE | |
| first_name | VARCHAR(100) NOT NULL | |
| last_name | VARCHAR(100) NOT NULL | |
| date_of_birth | DATE | Nullable. PHI. |
| gender | VARCHAR(20) | Nullable. |
| avatar_url | TEXT | Nullable. Set after upload. |
| city | VARCHAR(100) | Nullable. |
| state | VARCHAR(50) | Nullable. |
| timezone | VARCHAR(50) DEFAULT 'America/Chicago' | IANA timezone (e.g. `America/New_York`). Used for reminders, digest timing, and calendar views. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | Auto-updated via trigger. |

**`provider_details`** — Provider-specific professional fields.

| Column | Type | Notes |
|---|---|---|
| user_id | UUID PK, FK → users(id) ON DELETE CASCADE | |
| license_number | VARCHAR(100) NOT NULL | |
| license_type | VARCHAR(100) NOT NULL | |
| specialty | VARCHAR(100) NOT NULL | |
| clinic_name | VARCHAR(200) NOT NULL | |
| credentials | TEXT | Comma-separated titles (e.g. "DDS, CCMC"). |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | Auto-updated via trigger. |

**`refresh_tokens`** — Active refresh tokens for all users.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| token_hash | VARCHAR(64) NOT NULL | SHA-256 hex of the opaque token. |
| token_family | UUID NOT NULL | Reuse detection. All rotated tokens share a family ID. |
| device_info | TEXT | User-Agent string (truncated to 500 chars). |
| ip_address | INET | Stored for audit. |
| expires_at | TIMESTAMPTZ NOT NULL | 7 days for patients, recreated on each provider login. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

**`sessions`** — Active sessions. Enables session management UI and inactivity timeout checks.

> **Why both `sessions` and `refresh_tokens`?** They serve different purposes. `refresh_tokens` handles token rotation and reuse detection (security). `sessions` tracks active login sessions for the UI ("You are logged in on 2 devices") and enforces the 15-minute provider inactivity timeout. A user can have one session but multiple rotated refresh tokens within it, or vice versa. Merging them would conflate rotation logic with timeout logic.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| device_info | TEXT | |
| ip_address | INET | |
| last_active | TIMESTAMPTZ DEFAULT NOW() | Updated on every authenticated request. |
| expires_at | TIMESTAMPTZ NOT NULL | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

**`mfa_backup_codes`** — One-time MFA recovery codes.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| code_hash | VARCHAR(255) NOT NULL | bcrypt hash of the plaintext code. |
| used | BOOLEAN DEFAULT FALSE | |
| used_at | TIMESTAMPTZ | Nullable. Set when used. |

**`password_resets`** — Password reset tokens.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| token_hash | VARCHAR(64) NOT NULL | SHA-256 hex of the opaque token sent in the email. |
| expires_at | TIMESTAMPTZ NOT NULL | 1-hour expiry. |
| used | BOOLEAN DEFAULT FALSE | Marked used immediately on consumption. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

### 6.3 Linking Tables

**`linking_codes`** — Provider-generated patient invite codes.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| code | VARCHAR(6) UNIQUE NOT NULL | Alphanumeric. Unique. |
| provider_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| patient_id | UUID, FK → users(id) ON DELETE SET NULL | Nullable until patient accepts. |
| status | ENUM('pending','connected','expired') DEFAULT 'pending' | |
| expires_at | TIMESTAMPTZ NOT NULL | 7 days from generation. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

**`patient_provider_links`** — Active patient-provider connections.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| patient_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| provider_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| linked_at | TIMESTAMPTZ DEFAULT NOW() | |
| unlinked_at | TIMESTAMPTZ | Nullable. Set on disconnect. |

Partial UNIQUE constraint on `(patient_id, provider_id) WHERE unlinked_at IS NULL`. This allows re-linking after disconnection while preventing duplicate active links.

### 6.4 Exercise Tables

**`exercises`** — Exercise video library, owned by providers.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| provider_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| title | VARCHAR(255) NOT NULL | |
| description | TEXT | |
| duration_seconds | INT | |
| category | VARCHAR(100) | |
| instructions | TEXT | |

> **Design note:** `description` and `instructions` are plain text fields — no rich text editor for MVP. The same `isomorphic-dompurify` sanitisation runs on these fields (single code path for all free-text input), but providers are expected to enter plain text. A rich text editor is a post-MVP enhancement.
| video_url | TEXT | |
| thumbnail_url | TEXT | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | Auto-updated via trigger. |

**`exercise_assignments`** — A provider assigns an exercise to a patient.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| exercise_id | UUID NOT NULL, FK → exercises(id) ON DELETE CASCADE | |
| patient_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| provider_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| frequency | VARCHAR(50) DEFAULT 'daily' | e.g. 'daily', '3x weekly' |
| sets | INT DEFAULT 1 | |
| status | ENUM('active','paused','completed') DEFAULT 'active' | |
| assigned_at | TIMESTAMPTZ DEFAULT NOW() | |

**`exercise_completions`** — Patient marks a daily exercise completion.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| assignment_id | UUID NOT NULL, FK → exercise_assignments(id) ON DELETE CASCADE | |
| patient_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| completed_at | TIMESTAMPTZ DEFAULT NOW() | |

UNIQUE constraint on `(assignment_id, patient_id, DATE(completed_at))` via a unique index to prevent double-counting completions on the same day.

### 6.5 Clinical Tables

**`symptom_logs`** — Daily symptom entries. Core PHI.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| patient_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| pain_level | INT NOT NULL, CHECK (pain_level BETWEEN 0 AND 10) | |
| pain_types | TEXT[] DEFAULT '{}' | e.g. `{'aching','sharp','throbbing'}` |
| body_areas | JSONB DEFAULT '[]' | Flexible area map. e.g. `[{"area":"jaw","side":"left"}]` |
| duration_minutes | INT | Nullable. Duration of pain episode. |
| triggers | TEXT[] DEFAULT '{}' | e.g. `{'chewing','stress','cold'}` |
| notes | TEXT | Free text. Nullable. |
| logged_at | TIMESTAMPTZ DEFAULT NOW() | Client-provided log timestamp. **Constrained:** Zod validation rejects values more than 24 hours in the past or any time in the future. This prevents patients from backdating entries to exploit the edit window. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | Server-set. Immutable after insert. Used as the anchor for the 24-hour edit window trigger. |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | Editable within 24 hours of `created_at` only (enforced by DB trigger). |

**`reports`** — Patient-to-provider periodic reports. Core PHI.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| patient_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| provider_id | UUID NOT NULL, FK → users(id) ON DELETE SET NULL | Set NULL when provider is hard-deleted. Report history is preserved with anonymised provider reference. The `cleanupJob` must SET NULL on `reports.provider_id` and `report_responses.provider_id` before hard-deleting a user. |
| urgency | ENUM('routine','concerning','urgent') NOT NULL | |
| pain_level | INT, CHECK (pain_level BETWEEN 0 AND 10) | Nullable. |
| description | TEXT NOT NULL | |
| photo_url | TEXT | Nullable. Attached photo. |
| period_start | DATE | Nullable. Report period start. |
| period_end | DATE | Nullable. Report period end. |
| summary_data | JSONB DEFAULT '{}' | Auto-generated stats snapshot at time of submission. |
| patient_notes | TEXT | Free text. |
| status | ENUM('submitted','viewed','reviewed','responded') DEFAULT 'submitted' | |
| flagged | BOOLEAN DEFAULT FALSE | Provider can flag for follow-up. |
| submitted_at | TIMESTAMPTZ DEFAULT NOW() | |
| viewed_at | TIMESTAMPTZ | Nullable. Set when provider first opens. |
| reviewed_at | TIMESTAMPTZ | Nullable. |

**`report_responses`** — Provider text response to a report.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| report_id | UUID NOT NULL, FK → reports(id) ON DELETE CASCADE | |
| provider_id | UUID NOT NULL, FK → users(id) ON DELETE SET NULL | See `reports.provider_id` note. |
| message | TEXT NOT NULL | Visible to patient. |
| internal_notes | TEXT | Nullable. Never returned to patient. |
| responded_at | TIMESTAMPTZ DEFAULT NOW() | |

A provider may respond to the same report multiple times (each creates a new row). The patient sees all responses in chronological order. `internal_notes` are never returned in patient-facing API responses.

### 6.6 Notification Tables

**`notifications`** — In-app notification store.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| type | VARCHAR(50) NOT NULL | e.g. `'exercise_assigned'`, `'report_urgent'` |
| title | VARCHAR(255) NOT NULL | |
| body | TEXT NOT NULL | |
| data | JSONB DEFAULT '{}' | Extra payload for deep linking. |
| read | BOOLEAN DEFAULT FALSE | |
| read_at | TIMESTAMPTZ | Nullable. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

**`notification_preferences`** — Per-user channel preferences.

| Column | Type | Notes |
|---|---|---|
| user_id | UUID PK, FK → users(id) ON DELETE CASCADE | |
| exercise_reminders | BOOLEAN DEFAULT TRUE | |
| symptom_checkin | BOOLEAN DEFAULT TRUE | |
| provider_messages | BOOLEAN DEFAULT TRUE | |
| report_updates | BOOLEAN DEFAULT TRUE | |
| tips_updates | BOOLEAN DEFAULT FALSE | |
| email_digest | ENUM('instant','daily','weekly','off') DEFAULT 'instant' | |
| next_digest_at | TIMESTAMPTZ | Pre-computed next UTC time for weekly digest delivery. Recalculated after each digest send and whenever `profiles.timezone` changes. The `weeklyDigestJob` queries `WHERE next_digest_at <= NOW() AND email_digest != 'off'` — no per-row timezone math at runtime. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | Auto-updated via trigger. |

**`reminders`** — Scheduled push reminders configured by the user.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID NOT NULL, FK → users(id) ON DELETE CASCADE | |
| type | ENUM('exercise','symptom') NOT NULL | |
| time | TIME NOT NULL | Stored in the user's local time (from `profiles.timezone`). Used to compute `next_fire_at`. |
| days | JSONB NOT NULL DEFAULT '["mon","tue","wed","thu","fri"]' | Array of day codes. |
| enabled | BOOLEAN DEFAULT TRUE | |
| next_fire_at | TIMESTAMPTZ | Pre-computed next UTC fire time. Recalculated after each fire and whenever `time`, `days`, `timezone`, or `enabled` changes. The `reminderJob` queries only `WHERE next_fire_at <= NOW() AND enabled = true` — no per-row timezone math at runtime. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ DEFAULT NOW() | Auto-updated via trigger. |

### 6.7 System Tables

**`audit_logs`** — Immutable HIPAA audit trail. Append-only. Retained for 6 years minimum.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID, FK → users(id) **ON DELETE SET NULL** | **Critical:** never cascade-delete audit entries. Set NULL when user is deleted, never lose the row. |
| action | VARCHAR(100) NOT NULL | e.g. `'patient.symptoms.create'`, `'auth.login.failed'` |
| resource_type | VARCHAR(50) | e.g. `'symptom_log'`, `'report'` |
| resource_id | UUID | Nullable. The ID of the affected record. |
| ip_address | INET | |
| user_agent | TEXT | |
| metadata | JSONB DEFAULT '{}' | Contextual data. e.g. `{"pain_level": 5}`. Never store raw PHI. |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

> **HIPAA requirement:** `audit_logs` is append-only. The database role used by the API has `INSERT` permission only on this table. `UPDATE` and `DELETE` are revoked. The cleanup job must never touch this table. Audit logs for deleted users are retained with `user_id = NULL`.

> **Immutability enforcement:** `symptom_logs` has a database-level constraint that prevents editing after 24 hours. A `BEFORE UPDATE` trigger checks `NOW() - OLD.created_at < INTERVAL '24 hours'` and raises an exception if violated. The window is anchored to `created_at` (server-set, immutable) — not `logged_at` (client-provided) — so patients cannot exploit the edit window by backdating `logged_at`.

```sql
CREATE OR REPLACE FUNCTION enforce_symptom_edit_window()
RETURNS TRIGGER AS $$
BEGIN
  IF (NOW() - OLD.created_at) > INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Symptom log edit window has expired (24 hours from creation).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_symptom_edit_window
  BEFORE UPDATE ON symptom_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_symptom_edit_window();
```

**`login_events`** — Login history for security monitoring.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID, FK → users(id) ON DELETE SET NULL | Nullable. Set NULL when user deleted. Retained for monitoring. |
| email | VARCHAR(255) NOT NULL | Stored separately so failed login events are still recorded even if user_id is unknown. |
| success | BOOLEAN NOT NULL | |
| ip_address | INET | |
| device_info | TEXT | |
| failure_reason | VARCHAR(100) | Nullable. e.g. `'invalid_password'`, `'account_locked'`, `'email_not_verified'` |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

### 6.8 Indexes

```sql
-- users
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active) WHERE deleted_at IS NULL;

-- refresh_tokens
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_family ON refresh_tokens(token_family);

-- sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- password_resets
CREATE INDEX idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);

-- linking_codes
CREATE UNIQUE INDEX idx_linking_codes_code ON linking_codes(code);
CREATE INDEX idx_linking_codes_provider_id ON linking_codes(provider_id);

-- patient_provider_links
CREATE UNIQUE INDEX idx_ppl_active_link ON patient_provider_links(patient_id, provider_id) WHERE unlinked_at IS NULL;
CREATE INDEX idx_ppl_patient_id ON patient_provider_links(patient_id) WHERE unlinked_at IS NULL;
CREATE INDEX idx_ppl_provider_id ON patient_provider_links(provider_id) WHERE unlinked_at IS NULL;

-- exercise_assignments
CREATE INDEX idx_ea_patient_id ON exercise_assignments(patient_id) WHERE status = 'active';
CREATE INDEX idx_ea_provider_id ON exercise_assignments(provider_id);

-- exercise_completions
CREATE UNIQUE INDEX idx_ec_daily_unique ON exercise_completions(assignment_id, patient_id, (completed_at::date));
CREATE INDEX idx_ec_patient_logged ON exercise_completions(patient_id, completed_at);

-- symptom_logs
CREATE INDEX idx_sl_patient_logged ON symptom_logs(patient_id, logged_at DESC);

-- reports
CREATE INDEX idx_reports_provider_status ON reports(provider_id, status);
CREATE INDEX idx_reports_urgency ON reports(urgency, submitted_at DESC);
CREATE INDEX idx_reports_patient ON reports(patient_id);

-- notifications
CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC) WHERE read = FALSE;

-- reminders
CREATE INDEX idx_reminders_next_fire ON reminders(next_fire_at) WHERE enabled = TRUE;
CREATE INDEX idx_reminders_user ON reminders(user_id) WHERE enabled = TRUE;

-- notification_preferences
CREATE INDEX idx_notif_prefs_next_digest ON notification_preferences(next_digest_at) WHERE next_digest_at IS NOT NULL;

-- audit_logs
CREATE INDEX idx_audit_user_time ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action_time ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- login_events
CREATE INDEX idx_login_user_time ON login_events(user_id, created_at DESC);
CREATE INDEX idx_login_email_time ON login_events(email, created_at DESC);
```

### 6.9 Triggers

```sql
-- Reusable trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to every table with updated_at
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- (Same pattern for: profiles, provider_details, exercises, symptom_logs,
--  notification_preferences, reminders)
```

### 6.10 Database Permissions (HIPAA)

```sql
-- Create restricted API role
CREATE ROLE tmjconnect_api LOGIN PASSWORD '...';

-- Grant standard access to all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tmjconnect_api;

-- Revoke write access on audit_logs (append-only)
REVOKE UPDATE, DELETE ON audit_logs FROM tmjconnect_api;

-- Revoke delete on login_events
REVOKE DELETE ON login_events FROM tmjconnect_api;
```

---

## 7. Authentication & Authorization

### 7.1 Registration Flow

**All steps 4–10 below are wrapped in a single database transaction via `db.transaction()`. If any step fails, the entire operation rolls back — no orphaned rows.**

1. Client submits: `email`, `password`, `first_name`, `last_name`, `role`. Providers also submit: `license_number`, `license_type`, `specialty`, `clinic_name`.
2. Validate all fields with Zod. Password must be: ≥8 characters, at least one digit, at least one special character (`!@#$%^&*`).
3. Check email uniqueness (case-insensitive). Return `409 Conflict` if taken.
4. Hash password with `bcrypt` (12 rounds).
5. Generate a cryptographically random 6-digit code via `crypto.randomInt(100000, 999999)`. Store code + 24h expiry on the user record.

   > **Brute-force math:** The code space is 900,000 values (100000–999999). With the 5-attempt lockout (after 5 failed verification attempts, the code is invalidated), an attacker has a 5/900,000 = **0.00056%** chance of guessing a valid code per code issuance. Combined with the per-IP rate limit on `/auth/verify-email` (5 requests/15 min), automated brute-force is infeasible.
6. Insert `users` row (`email_verified = false`).
7. Insert `profiles` row (with `timezone` from client or default `America/Chicago`).
8. If provider: insert `provider_details` row.
9. Insert default `notification_preferences` row.
10. Send verification email via Resend with the 6-digit code.
11. Return `201 Created` with `{ message: "Check your email to verify your account." }`. **Do not return any tokens.**

### 7.2 Email Verification Flow

1. Client submits `email` + `code`.
2. Look up user by email. Check `email_verified = false`, code matches, and `email_verify_expires > NOW()`.
3. Set `email_verified = true`. Clear `email_verify_code` and `email_verify_expires`.
4. Send welcome email via Resend.
5. If **patient**: issue access token + refresh token. Return tokens.
6. If **provider**: do not issue tokens yet. Return `{ mfaSetupRequired: true }`. Provider must complete MFA setup before any tokens are issued.

### 7.3 MFA Setup (Providers Only — Required Before First Login)

1. Provider calls `POST /auth/mfa/setup`. Must be authenticated with a temporary setup token (short-lived JWT issued after email verification, `purpose: 'mfa_setup'`, 10-minute expiry).
2. Generate TOTP secret with `otpauth`. Return `{ secret, qrUri }` where `qrUri` is an `otpauth://` URI.
3. Provider scans QR code in authenticator app and submits a 6-digit verification code.
4. `POST /auth/mfa/verify-setup`: verify the submitted code against the secret. On success:
   - Store `mfa_secret` on user record. Set `mfa_enabled = true`.
   - Generate 10 one-time backup codes using `crypto.randomBytes(5).toString('hex')` (10 chars each). Hash each with `bcrypt` and store in `mfa_backup_codes`.
   - Return the 10 plaintext backup codes to the provider. **Shown exactly once. Provider must save them.**
5. Discard the setup token. Provider can now proceed to login.

### 7.4 Login Flow

1. Client submits `email` + `password`.
2. Look up user by email where `deleted_at IS NULL` and `is_active = true`. If not found: run a dummy `bcrypt.compare('', DUMMY_HASH)` to consume the same time as a real comparison, then return `401` with a generic message. This prevents timing-based account enumeration — an attacker cannot distinguish "email not found" from "wrong password" by measuring response time.
3. **Account lockout check:** count `login_events` for this email in the last 30 minutes where `success = false`. If ≥ 5, return `429` with `{ code: 'ACCOUNT_LOCKED', message: 'Account locked. Try again in 30 minutes.' }`. Do not check password.
4. Compare submitted password against `password_hash` with `bcrypt.compare`.
5. If **wrong password:**
   - Insert failed `login_event` row.
   - If this is the 5th failure: send `account_locked` email.
   - Return `401 Unauthorized`.
6. If **correct password:**
   - Ensure `email_verified = true`. Return `403` with `VERIFY_EMAIL` code if not.
7. If **patient:**
   - Issue access token + refresh token.
   - Create `sessions` row.
   - Insert successful `login_event`.
   - Check if the device is new (compare `device_info` with recent sessions for this user). If new device: send `new_device_login` email.
   - Return tokens.
8. If **provider:**
   - Do not issue full tokens yet.
   - Return `{ mfaRequired: true, mfaToken: <short-lived JWT, 5 min, purpose:'mfa', userId> }`.

### 7.5 MFA Verification (Providers — Login Continuation)

1. Client submits `mfaToken` + `code` (TOTP 6-digit, or SMS code, or backup code).
2. Verify `mfaToken` is a valid JWT with `purpose: 'mfa'` and not expired.
3. **TOTP path:** Verify `code` against `mfa_secret` using `otpauth`. Accept ±30s window.
4. **SMS fallback path:** Use a separate short-lived code sent via Twilio. Same storage pattern as email verify codes: store hash + expiry on user record. Not stored permanently.
5. **Backup code path:** Hash submitted code. Compare against all unused `mfa_backup_codes` for the user. Mark matched code as `used`. If no match: return `401`.
6. On success:
   - Issue full access token + refresh token.
   - Create `sessions` row.
   - Insert successful `login_event`.
   - New device check → send `new_device_login` email if needed.

### 7.6 Token Management

| Token | Format | Storage | Expiry |
|---|---|---|---|
| Access token | JWT signed with `JWT_SECRET` | **Web:** client memory only (never `localStorage`). **Mobile:** Expo `SecureStore` (encrypted keychain on iOS, encrypted SharedPreferences on Android). Required for HIPAA — plaintext storage on mobile is a compliance violation. | 15 minutes |
| Refresh token | 64-byte random hex, opaque | **Web:** `httpOnly` cookie or client memory. **Mobile:** Expo `SecureStore`. SHA-256 hash stored in `refresh_tokens` table. | 7 days (patient) / invalidated on session timeout (provider) |
| MFA token | JWT signed with `JWT_SECRET`, `purpose: 'mfa'` field | Client in-flight only | 5 minutes |
| Setup token | JWT signed with `JWT_SECRET`, `purpose: 'mfa_setup'` field | Client in-flight only | 10 minutes |

**Access token payload:** `{ id: UUID, email: string, role: 'patient'|'provider'|'admin', iat, exp }`

**Refresh token rotation:**
1. Client sends opaque refresh token.
2. Hash the token (SHA-256). Look up in `refresh_tokens` by `token_hash`.
3. **Reuse detection:** if `token_hash` is not found in the table but the `token_family` was previously used (check family with a second query), it means a stolen token has been used. **Invalidate all tokens for the entire family.** Log the event. Force the user to re-login.

   > **Known pilot limitation:** The family check requires a second query on every token miss (expired or deleted tokens). At 50 users this is negligible. **Production path:** maintain an in-memory TTL map (5-minute TTL) of recently revoked family IDs. If the family is in the map, skip the DB query and reject immediately. Alternatively, promote to a `revoked_families` table with a TTL cleanup job.
4. If valid: delete the old `refresh_tokens` row. Issue a new `access token + refresh token` pair. Insert a new `refresh_tokens` row with the same `token_family`.
5. Return the new token pair.

**Logout:** Delete the matching `refresh_tokens` row. The access token naturally expires.
**Logout all devices:** Delete all `refresh_tokens` and `sessions` rows for the user.

### 7.7 Provider Session Timeout (HIPAA)

Every authenticated provider request passes through `checkSessionTimeout` middleware:

1. Find the session for this provider (matched by `user_id` stored in JWT).
2. If `last_active < NOW() - INTERVAL '15 minutes'`: delete the session row, return `401` with `{ code: 'SESSION_TIMEOUT' }`. The client redirects to login.
3. Otherwise: `UPDATE sessions SET last_active = NOW() WHERE id = $1`.

Patient sessions do not have an inactivity timeout — they use the 7-day refresh token expiry.

### 7.8 Password Reset Flow

1. Client submits `email` to `POST /auth/forgot-password`.
2. Always return `200 OK` regardless of whether the email exists (prevent user enumeration).
3. If user found: generate 64-byte random hex token. Store `SHA-256(token)` in `password_resets` with 1-hour expiry. Send password reset email with the plaintext token in a link.
4. Client follows link. `POST /auth/reset-password` with `{ token, newPassword }`.
5. Hash submitted token. Look up in `password_resets` where `used = false` and `expires_at > NOW()`. Return `400` if not found.
6. Hash new password with `bcrypt`. Update `users.password_hash`. Mark reset token `used = true`.
7. Delete all `refresh_tokens` and `sessions` for the user (force re-login everywhere).
8. Return `200 OK`.

### 7.9 Role-Based Access Control (RBAC)

Three roles. Enforced by `authorize(role)` middleware on every route.

| Role | Can Access | Key Restrictions |
|---|---|---|
| `patient` | Own profile, own exercises, own symptoms, own reports, own notifications | Cannot access any other patient's data. Every query includes `WHERE patient_id = req.user.id`. |
| `provider` | Own profile, linked patients only, own exercise library, report inbox | Cannot access unlinked patients. Must complete MFA on every login. Session timeout enforced. |
| `admin` | All users, all data, audit logs, system monitoring | Separate dashboard application. Full read. Write for user management only. |

**Middleware chain on every authenticated route:**
```
requestTimeout → rateLimiter → authenticate → authorize(role) → [checkSessionTimeout (providers only)] → auditLog → routeHandler
```

---

## 8. API Route Map

All routes prefixed with `/api/v1`. No exceptions. This prefix enables a clean `/api/v2` route in future without breaking existing clients.

**API versioning strategy:** When breaking changes are needed, a `/api/v2` prefix is added alongside `/api/v1`. Both versions run in the same Express app. `/api/v1` routes are maintained for a minimum of 6 months after `/api/v2` goes live. Clients are notified of deprecation via a `Sunset` response header on v1 routes and a changelog entry in `docs/API_CHANGELOG.md`. After the sunset period, v1 routes return `410 Gone`.

### 8.1 Auth Routes (Public / Partial Auth)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/register | Public | Register patient or provider |
| POST | /auth/verify-email | Public | Verify email with 6-digit code |
| POST | /auth/login | Public | Email + password login |
| POST | /auth/mfa/setup | Setup token | Generate TOTP secret + QR URI |
| POST | /auth/mfa/verify-setup | Setup token | Confirm TOTP setup with first code. Returns backup codes. |
| POST | /auth/mfa/verify | MFA token | Verify TOTP / SMS / backup code. Returns full tokens. |
| POST | /auth/mfa/sms | MFA token | Send SMS fallback MFA code |
| POST | /auth/refresh | Refresh token | Rotate access + refresh tokens |
| POST | /auth/forgot-password | Public | Send password reset email |
| POST | /auth/reset-password | Reset token | Set new password |
| POST | /auth/resend-verify-email | Public | Resend 6-digit verification code. Rate-limited to 1 per 2 minutes per email. Generates new code + expiry. Always returns 200 (prevent enumeration). |
| DELETE | /auth/logout | Authenticated | Invalidate current refresh token |
| DELETE | /auth/logout-all | Authenticated | Invalidate all sessions + refresh tokens |
| PATCH | /auth/change-password | Authenticated | Change password (requires current password) |
| PATCH | /auth/fcm-token | Authenticated | Update FCM push token on device change |

### 8.2 Patient Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /patients/me | Patient | Get own profile with linked provider info |
| PATCH | /patients/me | Patient | Update profile fields |
| DELETE | /patients/me | Patient | Soft delete account |
| GET | /patients/me/sessions | Patient | List active sessions |
| DELETE | /patients/me/sessions/:id | Patient | Terminate a specific session |
| GET | /patients/me/exercises | Patient | List active exercise assignments |
| POST | /patients/me/exercises/:assignmentId/complete | Patient | Mark exercise completed |
| GET | /patients/me/symptoms | Patient | Symptom history (paginated) |
| POST | /patients/me/symptoms | Patient | Create symptom log entry |
| PATCH | /patients/me/symptoms/:id | Patient | Edit symptom log (within 24h window only) |
| GET | /patients/me/symptoms/calendar | Patient | Calendar view — day-level summaries for a given month |
| GET | /patients/me/reports | Patient | List own submitted reports |
| POST | /patients/me/reports | Patient | Submit report to linked provider |
| GET | /patients/me/reports/:id | Patient | Report detail (includes provider response, never `internal_notes`) |
| GET | /patients/me/notifications | Patient | Notification list (paginated, newest first, unread count in header) |
| PATCH | /patients/me/notifications/:id/read | Patient | Mark single notification as read |
| PATCH | /patients/me/notifications/read-all | Patient | Mark all notifications as read |
| GET | /patients/me/reminders | Patient | List all reminders |
| POST | /patients/me/reminders | Patient | Create reminder |
| PATCH | /patients/me/reminders/:id | Patient | Update reminder |
| DELETE | /patients/me/reminders/:id | Patient | Delete reminder |

### 8.3 Provider Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /providers/me | Provider | Get own profile + professional details |
| PATCH | /providers/me | Provider | Update profile + provider details |
| GET | /providers/patients | Provider | Dashboard — list linked patients with stats (last active, avg pain, adherence %) |
| GET | /providers/patients/:id | Provider | Patient detail. Must be actively linked. Returns profile + recent symptoms + exercises + reports. |
| GET | /providers/patients/:id/symptoms | Provider | Patient symptom history (paginated) |
| GET | /providers/patients/:id/exercises | Provider | Patient exercise assignments + completion rate |
| GET | /providers/patients/:id/reports | Provider | Patient report history |
| GET | /providers/exercises | Provider | Own exercise library |
| POST | /providers/exercises | Provider | Create exercise (with pre-uploaded video_url) |
| PATCH | /providers/exercises/:id | Provider | Update exercise details |
| DELETE | /providers/exercises/:id | Provider | Delete exercise (cascades to assignments) |
| POST | /providers/assignments | Provider | Assign exercise to a linked patient |
| PATCH | /providers/assignments/:id | Provider | Update assignment (frequency, sets, status) |
| DELETE | /providers/assignments/:id | Provider | Remove assignment |
| GET | /providers/reports | Provider | Report inbox — sorted by urgency then date. Filterable by status, patient, date range. |
| GET | /providers/reports/:id | Provider | Full report detail + patient recent symptom history |
| POST | /providers/reports/:id/respond | Provider | Send text response to patient |
| PATCH | /providers/reports/:id/review | Provider | Mark reviewed without responding |
| PATCH | /providers/reports/:id/flag | Provider | Toggle flag on report |
| GET | /providers/linking/codes | Provider | List all invite codes with current status |
| POST | /providers/linking/generate | Provider | Generate new 6-char alphanumeric invite code (7-day expiry). On unique constraint violation, retry up to 3 times with a new random code before returning an error. |
| POST | /providers/linking/email-invite | Provider | Generate code + send invite email directly to a patient email address |
| DELETE | /providers/linking/:linkId | Provider | Disconnect a patient (softly — sets unlinked_at) |
| GET | /providers/me/sessions | Provider | List active sessions |
| DELETE | /providers/me/sessions/:id | Provider | Terminate a session |
| GET | /providers/notifications | Provider | Notification list |
| PATCH | /providers/notifications/:id/read | Provider | Mark notification read |
| GET | /providers/notifications/preferences | Provider | Get notification preferences |
| PATCH | /providers/notifications/preferences | Provider | Update notification preferences |

### 8.4 Linking Routes (Cross-Role)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /linking/accept | Patient | Accept provider invite code. Validates code is pending and not expired. Creates `patient_provider_links` row. Updates code status. Sends `link_accepted` notification to provider. |

### 8.5 Upload Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /uploads/video | Provider | Upload exercise video. multipart/form-data. Max 100MB. MP4 or MOV only. Returns `{ videoUrl }`. |
| POST | /uploads/avatar | Authenticated | Upload profile photo. Max 5MB. JPEG or PNG only. Returns `{ avatarUrl }`. |
| POST | /uploads/report-photo | Patient | Upload photo for report attachment. Max 10MB. JPEG or PNG only. Returns `{ photoUrl }`. |

### 8.6 Admin Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /admin/stats | Admin | Dashboard stats: user counts by role, active users (last 7d), reports today, avg provider response time, exercise completion rate |
| GET | /admin/users | Admin | List all users. Searchable by name/email. Filterable by role, status, date range. Paginated. |
| GET | /admin/users/:id | Admin | User detail: profile, provider details, active sessions, recent audit log entries, login events |
| PATCH | /admin/users/:id | Admin | Update user: activate/deactivate, change role, force password reset flag, force MFA reset |
| GET | /admin/audit-logs | Admin | Query audit trail. Filterable by user_id, action, resource_type, date range. Paginated. Sorted by created_at DESC. |
| GET | /admin/audit-logs/export | Admin | Export audit logs as CSV for a given date range. **Maximum date range: 90 days.** For larger exports, make multiple requests. Response is streamed to avoid memory exhaustion. |
| GET | /admin/login-events | Admin | All login events. Filterable by user, success/failure, date range. |
| GET | /admin/reports | Admin | All reports across all providers. For monitoring response times and urgency handling. |

---

## 9. Notification System

### 9.1 Architecture

A single `notify()` function is the only way the application dispatches notifications. Route handlers never call Resend, Twilio, or FCM directly.

```typescript
// The single interface. All route handlers call this.
notify({
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>
})
```

Internally, `notify()` does three things in order:
1. **Always** inserts a row into the `notifications` table (in-app record — the source of truth). If this INSERT fails, the error is logged to Sentry **and** the full notification payload is written to a structured pino log line tagged `notification_lost` (including `userId`, `type`, `title`, `body`, `data`). This makes lost notifications recoverable from log aggregation. The error does **not** propagate to the calling route handler — the user's API request still succeeds. Post-MVP: add a dead-letter queue for automatic retry.
2. Reads the user's `notification_preferences` row.
3. Dispatches to enabled external channels concurrently (`Promise.all`). Fire-and-forget — errors in external channels are logged but do not throw.

### 9.2 Channel Map

| Notification Type | In-App | Push (FCM) | Email (Resend) | SMS (Twilio) |
|---|---|---|---|---|
| `exercise_reminder` | ✓ | ✓ | | |
| `symptom_checkin` | ✓ | ✓ | | |
| `provider_message` | ✓ | ✓ | ✓ | |
| `report_submitted` (to provider) | ✓ | ✓ | ✓ | |
| `report_urgent` (to provider) | ✓ | ✓ | ✓ | ✓ |
| `report_reviewed` | ✓ | ✓ | | |
| `exercise_assigned` | ✓ | ✓ | | |
| `link_accepted` | ✓ | | ✓ | |
| `welcome` | | | ✓ | |
| `password_reset` | | | ✓ | |
| `mfa_code` | | | | ✓ |
| `new_device_login` | | | ✓ | |
| `weekly_summary` | ✓ | ✓ | ✓ | |
| `account_locked` | | | ✓ | |
| `streak_milestone` | ✓ | ✓ | | |

### 9.3 In-App Notification Polling

For MVP, clients poll `GET /patients/me/notifications` every 30 seconds when the app is in the foreground. This is zero complexity on the server.

SSE or WebSockets are a post-MVP enhancement. Do not implement for Phase 1.

### 9.4 Email Templates

All email templates are functions that return `{ subject: string, html: string }`. They live in `services/email.ts`. Each template includes:
- TMJConnect branding: navy header (`#1B2A4A`), gold CTA button (`#D4AF37`).
- Footer with tagline "Care Beyond the Chair" and unsubscribe/support links.
- Mobile-responsive inline CSS.

Templates required: `welcome`, `emailVerify`, `passwordReset`, `newDeviceLogin`, `accountLocked`, `linkAccepted`, `reportSubmitted`, `reportReviewed`, `weeklyDigest`, `emailInvite`.

### 9.5 Sentry PII Scrubbing

Before any error is sent to Sentry, the `beforeSend` hook must strip the following fields from all event contexts and breadcrumbs: `email`, `password`, `phone`, `token`, `code`, `ip_address`, `date_of_birth`, and any key that contains the substring `"phi"`. This must be configured before any other Sentry usage.

---

## 10. File & Video Storage

### 10.1 Storage Abstraction (Open/Closed Principle)

`storage.ts` defines a `StorageDriver` interface. Two implementations exist behind it. Route handlers call only the interface — they never reference a specific driver.

```typescript
interface StorageDriver {
  upload(file: Express.Multer.File, folder: string): Promise<{ key: string; url: string }>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
}
```

**`LocalDriver`** (`STORAGE_DRIVER=local`): Saves files to `UPLOAD_DIR` on disk. Returns a URL relative to `API_URL`. Files are served by Nginx at `/uploads/`.

**`S3Driver`** (`STORAGE_DRIVER=s3`): Uploads to `S3_BUCKET`. Returns a CloudFront signed URL. Required for production HIPAA compliance (S3 SSE + signed URLs).

Switching between drivers: change one environment variable. Zero code changes.

### 10.2 Video Upload Flow (No Transcoding for MVP)

1. Provider uploads via `POST /uploads/video` with `multipart/form-data`.
2. `multer` middleware validates: MIME type must be `video/mp4` or `video/quicktime`. File size ≤ 100MB.
3. `multer` is configured with a custom `filename` function that generates a random UUID (`crypto.randomUUID()`) as the filename — the original client filename is never used. This prevents path traversal, filename collisions, and leaks of client filesystem information.
4. Storage driver saves to `videos/` folder. Returns `{ videoUrl }`.
5. Provider creates the exercise record with the returned `video_url`.
6. Patients retrieve video via the URL stored on the exercise record.

No server-side video transcoding for pilot. Modern iPhone and Android devices record H.264 MP4 natively, which plays in all browsers and React Native without conversion.

Thumbnail: Provider uploads a thumbnail image separately via `POST /uploads/avatar` to the `thumbnails/` folder. No server-side extraction.

### 10.3 Upload Security Rules

| Upload Type | Max Size | Allowed MIME Types | Storage Folder |
|---|---|---|---|
| Exercise video | 100MB | `video/mp4`, `video/quicktime` | `videos/` |
| Profile avatar | 5MB | `image/jpeg`, `image/png` | `avatars/` |
| Report photo | 10MB | `image/jpeg`, `image/png` | `reports/` |
| Thumbnail | 2MB | `image/jpeg`, `image/png` | `thumbnails/` |

MIME type validation uses the file's actual magic bytes via multer's `fileFilter` — not the `Content-Type` header set by the client, which can be spoofed.

---

## 11. Audit Logging

### 11.1 What Gets Logged

Every API request that reads, creates, updates, or deletes PHI inserts a row into `audit_logs`. This includes:

- All auth events: login (success and failure), logout, MFA verify, MFA setup, password change, password reset.
- All PHI reads: patient viewing own data, provider viewing patient data, admin viewing any data.
- All PHI writes: symptom log created, exercise assigned, report submitted, profile updated, report responded.
- All admin actions: user activated/deactivated, role changed, data exported.

### 11.2 Log Format

```json
{
  "user_id": "uuid or null if user deleted",
  "action": "patient.symptoms.create",
  "resource_type": "symptom_log",
  "resource_id": "uuid-of-the-new-log",
  "ip_address": "203.0.113.5",
  "user_agent": "Mozilla/5.0 ...",
  "metadata": { "pain_level": 7 },
  "created_at": "2026-04-08T14:23:00Z"
}
```

`metadata` must never contain passwords, tokens, plaintext codes, full PHI records, or anything that should not appear in a log.

### 11.3 Implementation

`auditLog(action, resourceType?)` is a middleware factory. It runs after `authenticate` and returns a middleware that fires a database INSERT asynchronously without `await`. The route response is never delayed by audit logging.

```typescript
// Applied per-route:
router.post('/symptoms', authenticate, authorize('patient'), auditLog('patient.symptoms.create', 'symptom_log'), handler);
```

### 11.4 HIPAA Retention

`audit_logs` rows must be retained for a minimum of **6 years** per HIPAA. The `cleanupJob` must never touch this table. User hard-deletion sets `user_id = NULL` on existing audit rows (FK `ON DELETE SET NULL`) but does not delete the rows.

---

## 12. Scheduled Jobs

All jobs are registered in `jobs/index.ts` using `node-cron`. Each job is a separate file with a single exported `start()` function.

**Job locking:** Every job callback acquires a PostgreSQL advisory lock (`pg_advisory_xact_lock(jobId)`) inside a transaction before executing. If a previous run is still in progress (e.g. due to a slow `weeklyDigestJob`), the lock acquisition fails and the current invocation skips silently. This prevents overlapping runs without external coordination. Each job has a unique integer ID defined in `config/constants.ts` (e.g. `REMINDER_JOB_LOCK = 1`, `CODE_EXPIRY_JOB_LOCK = 2`, etc.).

| Job | Schedule | Description |
|---|---|---|
| `reminderJob` | `* * * * *` (every minute) | Query `reminders WHERE next_fire_at <= NOW() AND enabled = true`. For each matched reminder, call `notify()` for that user. For `exercise` type reminders: skip if the user has already completed all active exercises today (in user's timezone). After firing, recalculate `next_fire_at` to the next matching UTC time based on `time`, `days`, and `profiles.timezone`. |
| `codeExpiryJob` | `0 * * * *` (every hour) | `UPDATE linking_codes SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()`. Also `DELETE FROM idempotency_keys WHERE expires_at < NOW()`. |
| `weeklyDigestJob` | `0 * * * *` (every hour, every day) | Query `notification_preferences WHERE next_digest_at <= NOW() AND email_digest != 'off'`. The cron runs every hour because `next_digest_at` is pre-computed per user's timezone — the cron itself has no day-of-week logic. For each matched patient who has logged at least one symptom in the past 7 days, generate a summary (avg pain level, exercises completed, completion rate, streak count) and call `notify()` with type `weekly_summary`. After sending, recalculate `next_digest_at` to next Sunday 6 PM in the user's timezone (UTC equivalent). |
| `cleanupJob` | `0 3 * * *` (daily 3 AM UTC) | **Safety-guarded.** Before executing: count accounts matching `deleted_at < NOW() - INTERVAL '30 days'`. If count exceeds 50, abort and send a Sentry alert for manual review. Otherwise process each user inside its own `db.transaction()`: (1) SET NULL on `reports.provider_id` and `report_responses.provider_id` for this user. (2) Anonymise PII in `profiles` (blank all fields). (3) Hard-DELETE the `users` row. Cascade deletes all linked records. If any single-user transaction fails, log the error to Sentry and continue to the next user — do not abort the entire batch. Audit logs and login events are retained via `ON DELETE SET NULL`. **Never touches `audit_logs` or `login_events` directly.** Log the count of deleted users to the application log on each run. |
| `orphanFileCleanupJob` | `0 4 * * *` (daily 4 AM UTC) | Query the database for all referenced file URLs across `exercises.video_url`, `exercises.thumbnail_url`, `profiles.avatar_url`, and `reports.photo_url` in a single query (collects a `Set` of referenced URLs). Then query the storage listing for all files in `videos/`, `avatars/`, `reports/`, `thumbnails/`. Files not in the referenced set and older than 7 days are deleted via `storage.delete()`. This single-query approach avoids the race condition where a file is uploaded between the filesystem walk and the DB lookup (the DB query is a point-in-time snapshot of all references). Log deleted file count. |

> **Known pilot limitation (orphan file cleanup):** The single-query-then-walk approach does not scale beyond a few hundred files. **Production path:** add a `file_uploads` tracking table with a `referenced` boolean column. When an upload is saved, insert a row. When a record references the file, set `referenced = true`. Orphan detection becomes a simple query: `SELECT * FROM file_uploads WHERE referenced = false AND created_at < NOW() - INTERVAL '7 days'`.

> **Known limitation (pilot):** All cron jobs run in the same Node.js process as the API server. If a job (e.g. `weeklyDigestJob` processing hundreds of patients) consumes significant CPU or memory, it can degrade API response times. This is acceptable for the pilot (25–50 users). **Production mitigation:** run jobs in a separate ECS task or worker process triggered by a cron scheduler, keeping the API process dedicated to request handling.

---

## 13. Admin Dashboard

Standalone React + Vite app deployed at `admin.tmjconnect.com`. Completely separate from the provider portal — separate codebase, separate deployment, separate URL.

### 13.0 Admin Authentication

Admin accounts follow the **same MFA flow as providers** (Section 7.3–7.5). TOTP-based MFA is mandatory — admins cannot log in without completing MFA setup. Admin sessions are subject to the **same 15-minute inactivity timeout** as providers (Section 7.7). This is non-negotiable given admin access to all PHI.

### 13.1 Dashboard Sections

| Section | Content | Actions |
|---|---|---|
| Overview | Total users by role, active users last 7d, reports submitted today, avg provider response time, system health indicators | Read-only |
| User Management | Searchable list of all users: role, status, email verified, last active | Activate/deactivate, change role, force password reset, force MFA reset |
| Audit Log Viewer | Filterable by user, action, resource type, date range | Export to CSV (date range required). Read-only. |
| Login Activity | All login events: success/failure, IP, device, timestamp | Filter by user, flag suspicious patterns |
| Report Monitor | All patient reports cross all providers, sorted by urgency, avg response time by provider | View detail. No editing. |
| System Stats | User growth chart, daily active users, exercise completion rates, symptom log frequency | Date range filter |

### 13.2 MVP Priority

Sprint 1 admin work: **User Management** and **Audit Log Viewer** only. All other sections are Sprint 3–4 deliverables.

---

## 14. Security & HIPAA Compliance

### 14.1 Encryption

| Layer | Mechanism |
|---|---|
| Client → API | TLS 1.2+ everywhere. HTTPS only. HSTS headers via Helmet. Certificate pinning on mobile (Expo plugin — add post-go-live to avoid cert rotation lockouts). |
| API → Database | `sslmode=require` on all PostgreSQL connections. On the VPS pilot, the Docker `pg` container is configured with a self-signed certificate. On AWS, RDS enforces SSL by default. The `DATABASE_URL` must include `?sslmode=require`. |
| Data at rest | PostgreSQL disk encryption (VPS: LUKS full-disk encryption; AWS: RDS encryption enabled). S3 server-side encryption (AES-256). |
| Database backups | All `pg_dump` output is encrypted before storage: piped through `gpg --symmetric --cipher-algo AES256` with a backup passphrase stored in a separate secrets vault (not in the `.env` file). Backup files are stored with `chmod 600` permissions on the VPS. On AWS, RDS snapshots are encrypted automatically. |
| Passwords | bcrypt, 12 salt rounds. Never stored plain. Never logged. Never returned in API responses. |
| MFA secrets | AES-256-GCM encrypted at the application level using `MFA_ENCRYPTION_KEY` env var before storage and after retrieval. |
| Refresh tokens | Only SHA-256 hashes stored in database. Plaintext tokens transmitted once and never stored server-side. |
| Access tokens | Short-lived JWT (15 min). Not stored server-side. Signed with `JWT_SECRET` (min 64-character random string). |

### 14.2 Input Validation & Sanitisation

Every request passes through Zod validation followed by HTML sanitisation before any business logic executes. The `validate` middleware rejects malformed requests with `400 Bad Request` before they reach route handlers. After Zod parsing succeeds, all free-text string fields are sanitised via `isomorphic-dompurify` to strip HTML tags and attributes — preventing stored XSS. SQL injection is prevented by Drizzle's query builder, which parameterizes all values by default. The only exception is Drizzle's `sql` tagged template helper, which also parameterizes bound values — raw string concatenation into SQL is never permitted. File MIME types are validated by magic bytes, not `Content-Type` headers.

### 14.3 Rate Limiting

| Tier | Limit | Window | Applied To |
|---|---|---|---|
| General | 100 requests | 15 minutes | All routes |
| Auth | 10 requests | 15 minutes | `/auth/login`, `/auth/register`, `/auth/forgot-password` |
| MFA | 5 requests | 5 minutes | `/auth/mfa/*` |
| Password reset | 3 requests | 1 hour | `/auth/reset-password` |
| Email verify | 5 requests | 15 minutes | `/auth/verify-email`, `/auth/resend-verify-email` |

Additionally, after 5 failed verification code attempts for the same email, the code is invalidated and the user must request a new one via `/auth/resend-verify-email`.

### 14.4 HIPAA Compliance Checklist

| HIPAA Requirement | Implementation | Status |
|---|---|---|
| Access Control (§164.312a) | JWT + RBAC + provider MFA + 15-min session timeout + account lockout | Built into auth module |
| Audit Controls (§164.312b) | Immutable `audit_logs` table (INSERT-only DB role), `login_events` table, 6-year retention | Built into middleware + schema |
| Integrity Controls (§164.312c) | TLS in transit, AES-256 at rest, Zod input validation, parameterized SQL | Built into infrastructure + middleware |
| Transmission Security (§164.312e) | TLS 1.2+, HTTPS only, HSTS, certificate pinning (mobile) | Built into deployment |
| Person Authentication (§164.312d) | Email verification, TOTP MFA (providers), biometric optional (patients), password policy, account lockout | Built into auth module |
| Minimum Necessary | RBAC + scoped query helpers auto-inject ownership filters — route handlers never write raw `WHERE patient_id = req.user.id` | Built into DI container + all route handlers |
| BAA Chain | Resend, Twilio, Sentry, AWS — all require signed BAAs before go-live | Execute before go-live |
| Breach Notification | Documented incident response procedure (Section 14.7). Sentry alerting + admin monitoring. | Built in |
| Soft Deletes | Account deletion anonymises PII, hard-deletes after 30 days. Audit logs retained via SET NULL. | Built into schema + cleanupJob |

### 14.5 Helmet Configuration

```typescript
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
}));
```

### 14.6 CORS

```typescript
app.use(cors({
  origin: (origin, callback) => {
    const allowed = env.ALLOWED_ORIGINS.split(',');
    if (!origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
```

### 14.6.1 CSRF Protection

Cross-Site Request Forgery is mitigated through a layered approach:

1. **`SameSite=Lax` cookies.** All cookies (refresh token on web) are set with `SameSite=Lax`, which prevents them from being sent on cross-origin POST requests.
2. **Custom `X-Requested-With` header.** All state-changing requests (POST, PATCH, DELETE) from frontend clients must include `X-Requested-With: XMLHttpRequest`. The `authenticate` middleware rejects state-changing requests that are missing this header with `403 FORBIDDEN`. This header cannot be set by a cross-origin `<form>` submission — only by JavaScript running on an allowed origin (CORS-checked).
3. **Mobile apps** are not vulnerable to CSRF (no cookies), but still send the header for uniformity.

No CSRF tokens are needed because the combination of `SameSite=Lax` + custom header + CORS whitelist blocks all known CSRF vectors for a JSON API.

### 14.7 PHI Data Classification

HIPAA requires explicit identification of what constitutes Protected Health Information. The following columns are classified as PHI and subject to all HIPAA safeguards (audit logging, encryption, minimum necessary access, anonymisation on deletion):

| Table | PHI Columns | Notes |
|---|---|---|
| `users` | `email`, `phone` | Identifiers that link to clinical data. |
| `profiles` | `first_name`, `last_name`, `date_of_birth`, `gender`, `city`, `state`, `avatar_url` | Demographic identifiers. All blanked by `cleanupJob`. |
| `symptom_logs` | All columns | Entire table is clinical PHI. |
| `reports` | `description`, `patient_notes`, `photo_url`, `summary_data`, `pain_level` | Clinical content submitted by patient. |
| `report_responses` | `message`, `internal_notes` | Clinical provider-patient communication. |
| `exercise_assignments` | — | Not PHI itself, but links a patient to a treatment plan (PHI by association when joined with patient identity). |
| `exercise_completions` | — | Treatment adherence data (PHI by association). |
| `notifications` | `body`, `data` | May contain clinical references (e.g. "Your pain level was 7"). |
| `idempotency_keys` | `response_body` | Stores only `{ status, resourceId }` — never full response bodies. This prevents the idempotency cache from becoming an uncontrolled PHI store. |

**Rules derived from this classification:**
- `audit_logs.metadata` must never contain values from PHI columns. Log record IDs and aggregate values only (e.g. `{"pain_level": 5}` is acceptable; `{"notes": "Patient felt dizzy..."}` is not).
- Sentry `beforeSend` must strip all PHI column names from error contexts.
- The `cleanupJob` anonymisation step must blank every PHI column listed above before hard-deleting the user row.
- API responses must never include PHI of users other than the requesting user (or their linked patients for providers).

### 14.8 Incident Response Procedure

HIPAA requires a documented breach notification procedure (§164.408). This applies before any PHI is stored.

**Definition of a breach:** Unauthorised acquisition, access, use, or disclosure of PHI that compromises the security or privacy of the data.

**Immediate containment (within 1 hour of detection):**
1. Revoke compromised credentials (rotate `JWT_SECRET`, `JWT_REFRESH_SECRET`, database passwords) if credential compromise is suspected.
2. Isolate affected systems (disable public API, revoke VPS SSH keys if server-level breach).
3. Preserve evidence — do not delete logs, do not restart containers without capturing state.

**Investigation (within 24 hours):**
1. Query `audit_logs` and `login_events` to determine scope: which users, which records, which time window.
2. Identify the attack vector (stolen credentials, SQL injection, insider access, etc.).
3. Document findings in an incident report.

**Notification (within 60 days per HIPAA, but aim for 72 hours):**
1. Notify OROFACIAL leadership immediately (within 1 hour of confirmed breach).
2. Notify affected individuals in writing. Include: what happened, what data was involved, what they should do, what we are doing.
3. If breach affects ≥500 individuals: notify HHS Secretary and prominent media outlets in the state.
4. If breach affects <500 individuals: log for annual HHS reporting.

**Post-incident:**
1. Patch the vulnerability.
2. Update security controls to prevent recurrence.
3. Conduct a post-mortem and update this document if architectural changes are needed.

**Responsible parties:**
- **Detection:** Sentry alerts (P0 = unhandled exception in auth/audit code, P1 = 5xx spike, abnormal login pattern). AQION TECH monitors.
- **Containment + Investigation:** AQION TECH.
- **Notification + Legal:** OROFACIAL (with legal counsel).
- **On-call contact:** Defined in `docs/RUNBOOK.md` with phone numbers and escalation chain.

### 14.9 Least Privilege (Beyond Database)

Section 6.10 specifies database role permissions. This section extends the principle to all other system boundaries.

| Resource | Principle Applied |
|---|---|
| **Docker container** | API process runs as a non-root user (`USER node` in Dockerfile). No root access inside the container. |
| **File system** | The API process has write access only to `UPLOAD_DIR`. No write access to application code directories. Config files are read-only. |
| **S3 IAM policy** | The IAM role used by ECS tasks grants only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the `tmjconnect-uploads` bucket. No `s3:*` wildcard. No access to other buckets. |
| **Firebase service account** | Service account has only `cloudmessaging.messages.create` permission. No Firestore, no Auth, no Storage access. |
| **Sentry project** | Sentry DSN is project-scoped. No organisation-level token. PII scrubbing is enforced before any data leaves the API. |
| **GitHub Actions** | Workflow uses `permissions: contents: read, packages: write` only. No `admin`, no `pull_requests: write`. SSH key for VPS deployment is a deploy key with restricted access — not a user SSH key. |
| **VPS SSH** | SSH access is key-only (password auth disabled). Root login disabled. Only the `deploy` user can connect. Firewall allows only ports 80, 443, and 22. |

**Dockerfile least privilege:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN npm ci --only=production
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 14.10 Observability & Metrics

Beyond structured logging (Section 3.6) and audit logging (Section 11), the following observability mechanisms are built in for production monitoring:

**Health endpoint** (`GET /health`) — Section 15.5. Used by Docker/ECS for liveness checks.

**Request metrics** — `pino-http` logs `responseTime` on every request. In production, these logs are shipped to CloudWatch Logs (ECS) or parsed from Docker logs (pilot). Key metrics derived from logs:

| Metric | Source | Alert Threshold |
|---|---|---|
| p95 response time | `pino-http` `responseTime` field | > 500ms sustained for 5 min |
| 5xx error rate | `pino-http` `statusCode >= 500` | > 1% of requests in 5 min window |
| Failed login spike | `login_events WHERE success = false` | > 20 failures/hour for same IP |
| Database pool utilisation | `pg` pool events | Pool wait queue > 5 for 2 min |
| Audit log write failures | `pino` error logs from `audit.ts` | Any occurrence |

**Sentry integration:**
- Unhandled exceptions → Sentry with `requestId` tag.
- P0 alerts: unhandled exception in auth or audit code path.
- P1 alerts: 5xx spike (> 5 in 5 minutes).
- P2 alerts: external service failure (email, SMS, push).

**Production dashboards (post-pilot):** When migrating to AWS, CloudWatch dashboards track: API latency, error rates, RDS connection count, ECS CPU/memory, S3 request count. For pilot, `docker logs` + Sentry is sufficient.

---

## 15. Error Handling Strategy

### 15.1 Request ID Correlation

Every inbound request is assigned a unique `X-Request-ID` (UUID v4) in middleware. If the client sends an `X-Request-ID` header, it is used; otherwise, one is generated. This ID is:
- Included in the `audit_logs.metadata` for every audit entry on that request.
- Included in the error response body for 4xx/5xx responses.
- Attached to Sentry error events as a tag.
- Returned in the `X-Request-ID` response header.

This enables end-to-end tracing of a single request across application logs, audit records, and error tracking.

### 15.2 AppError Class

```typescript
class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}
```

Common codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `ACCOUNT_LOCKED`, `VERIFY_EMAIL`, `SESSION_TIMEOUT`, `MFA_REQUIRED`, `INTERNAL_ERROR`.

### 15.3 Global Error Handler

All errors funnel through a single Express error handler in `errorHandler.ts`:

1. **ZodError** → `400 VALIDATION_ERROR` with structured field errors.
2. **AppError** → Use the status code and code from the error.
3. **Database errors** → Map known PostgreSQL error codes (e.g. `23505` unique violation) to safe `409 CONFLICT` responses. Never return raw pg error messages.
4. **Unhandled errors** → `500 INTERNAL_ERROR`. Log the full error to Sentry in production. Return only a generic message to the client.

All error responses include the `X-Request-ID` for tracing.

### 15.4 Response Shape

All error responses return the same JSON shape:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [{ "field": "email", "message": "Invalid email address." }]
  }
}
```

**Success responses — single resource:**
Return the data directly at the top level (no wrapper).
```json
{ "id": "uuid", "email": "user@example.com", "role": "patient" }
```

**Success responses — paginated lists:**
All list endpoints return a `data` array and a `meta` object. This shape is defined in `packages/shared` and used by all clients.
```json
{
  "data": [{ "id": "uuid", "pain_level": 7, "logged_at": "2026-04-09T14:00:00Z" }],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

**Pagination strategy:** Two strategies are used depending on the access pattern:

1. **Cursor-based pagination** (for `symptom_logs` and `notifications`): These tables power infinite scroll on mobile. Use `WHERE logged_at < :cursor ORDER BY logged_at DESC LIMIT :limit` (or `created_at` for notifications). The response includes `nextCursor` (the last item's timestamp) instead of `total`/`page`. This avoids the `COUNT(*)` overhead and handles real-time inserts without page drift. The `parseCursorPagination()` utility extracts and validates the `cursor` and `limit` params.

2. **Offset-based pagination** (for all other list endpoints): Standard `page` + `limit` query params. `total` is computed via `COUNT(*)` in the same query. `hasMore` is `page * limit < total`. Used for admin tables, provider dashboards, report inbox — where total counts are useful and row counts are manageable.

The `parsePagination()` utility extracts and validates `page`/`limit` from query params, clamps `limit` to a maximum of 100, and returns `{ page, limit, offset }` for the Drizzle query.

**Cursor-based response shape:**
```json
{
  "data": [{ "id": "uuid", "pain_level": 7, "logged_at": "2026-04-09T14:00:00Z" }],
  "meta": {
    "limit": 20,
    "nextCursor": "2026-04-08T10:00:00Z",
    "hasMore": true
  }
}
```

**Offset-based response shape:**

### 15.5 Health Check Endpoint

`GET /health` returns a structured health response. It is **not** behind authentication or rate limiting.

```json
{ "status": "healthy", "timestamp": "2026-04-08T14:23:00Z", "checks": { "database": "ok", "uptime": 3600 } }
```

The endpoint executes `SELECT 1` against PostgreSQL. If the query fails or times out (>2s), the response returns `503 Service Unavailable` with `{ "status": "unhealthy", "checks": { "database": "failed" } }`. Docker and ECS health checks use this endpoint to determine container liveness.

---

## 16. Deployment Strategy

### 16.1 Pilot (VPS)

Single VPS with 4 vCPU, 8 GB RAM, 100 GB SSD running Docker Compose. Handles 25–50 concurrent users easily.

**`docker-compose.yml`:**
- `api` — Express.js (Node 20 Alpine). Port 3000. Health check on `/health`.
- `postgres` — PostgreSQL 16. Port 5432. Data persisted to named volume.
- `nginx` — Reverse proxy + SSL termination + static file serving. Ports 80, 443.

**Docker log rotation:** All services in `docker-compose.yml` include a `logging` block to prevent unbounded disk growth:
```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```
This caps each container's log at 50 MB (5 × 10 MB). Application logs flow through pino to stdout — Docker captures them. `docker compose logs` can still tail recent output.

**Deployment process:**
1. Push to `main` branch.
2. GitHub Actions: run tests → build Docker image → push to GitHub Container Registry (GHCR).
3. SSH into VPS. Pull new image. `docker compose up -d`. Health check confirms new container is up.

**Graceful shutdown:** The `index.ts` entry point registers a `SIGTERM` handler that:
1. Stops accepting new connections (`server.close()`).
2. Waits up to 5 seconds for in-flight requests to complete.
3. Closes the database pool (`pool.end()`).
4. Exits with code 0.

This ensures zero dropped requests on `docker compose up -d` (Docker sends `SIGTERM` to the old container). PM2 also forwards `SIGTERM` on restarts.

**Monthly cost:** ~$20–40/month (Hetzner CX31 or DigitalOcean Droplet).

### 16.2 Production (AWS)

Triggered when pilot user count exceeds 50–100 users or a compliance audit requires it.

| Pilot Component | AWS Replacement | Reason |
|---|---|---|
| Docker container (API) | ECS Fargate or EC2 | Auto-scaling, CloudWatch, zero-downtime deploys |
| Docker PostgreSQL | RDS PostgreSQL Multi-AZ | Automated backups, failover, point-in-time recovery |
| Local file storage | S3 + CloudFront | Signed URLs (HIPAA), unlimited storage, global CDN |
| Nginx SSL | ALB + ACM | Managed certificates, auto-renewal, WAF option |
| Nginx static files | S3 + CloudFront | No server load, cache headers |
| Cloudflare DNS | Route 53 | Unified AWS management, health checks |

**Migration steps:**
1. `pg_dump` from VPS PostgreSQL → `pg_restore` to RDS. One command.
2. `rsync` local `uploads/` directory to S3. Change `STORAGE_DRIVER=s3` env var.
3. Update DNS to point to ALB IP. Zero-downtime with low TTL pre-migration.
4. Decommission VPS after 7-day overlap period.

No code changes required. The Docker image that ran on VPS runs unchanged on ECS.

### 16.3 Nginx Configuration Highlights

```nginx
server {
    listen 443 ssl;
    server_name api.tmjconnect.com;

    # SSL
    ssl_certificate     /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    # API proxy
    location /api/ {
        proxy_pass         http://api:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 110M;  # Slightly above max upload size
    }

    # Serve uploaded files
    location /uploads/ {
        alias /data/uploads/;
        add_header Cache-Control "public, max-age=86400";
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

---

## 17. Non-Functional Requirements

| Requirement | Target | Mechanism |
|---|---|---|
| API response time | < 200ms p95 reads, < 500ms p95 writes | PostgreSQL indexes, connection pooling, Drizzle's thin query layer adds negligible overhead vs raw `pg` |
| Availability | 99.5% pilot, 99.9% production | Docker restart policy (pilot), Multi-AZ RDS + ECS (production) |
| Data backup | Daily automated + before every deploy | `pg_dump` cron job (pilot), RDS automated snapshots (production) |
| Backup restore verification | Monthly restore drill | Restore encrypted `pg_dump` to a test database and verify row counts match. Documented in `docs/RUNBOOK.md`. First drill before go-live. |
| Concurrent users | 50 pilot, 5,000+ production | Single instance (pilot), ECS auto-scaling (production) |
| Video upload | Max 100MB, MP4/MOV only | multer size + MIME type validation |
| Notification delivery | < 5s from trigger to push delivery | Fire-and-forget FCM calls from notify() |
| Mobile offline | Symptom logging queued locally | Expo SQLite queue + sync on reconnect (post-MVP Sprint 6+) |
| Accessibility | WCAG 2.1 AA minimum | Semantic HTML, 4.5:1 contrast, keyboard navigable |
| Browser support | Chrome, Firefox, Safari, Edge (latest 2 versions) | Standard React + Vite build |
| Audit log retention | 6 years minimum | Append-only table, no cleanupJob access, SET NULL on user delete |

---

## 18. Third-Party Services & BAA Chain

| Service | Provider | Purpose | BAA Required | Est. Monthly Cost (Pilot) |
|---|---|---|---|---|
| Database hosting | VPS provider | PostgreSQL 16 | N/A (self-hosted) | $0 (included in VPS) |
| Email | Resend | Transactional emails | **Yes — execute before go-live** | Free tier (3,000/month) |
| SMS | Twilio | MFA codes + urgent alerts | **Yes — execute before go-live** | $5–10 (low volume) |
| Push | Firebase Cloud Messaging | iOS + Android push | No (no PHI in payloads) | Free |
| Error tracking | Sentry | Crash reporting + alerting | **Yes — with PII scrubbing configured** | Free tier |
| CI/CD | GitHub Actions | Build + deploy pipelines | No (no PHI in repos) | Free (private repos) |
| DNS + DDoS | Cloudflare | DNS, DDoS protection | No (no PHI cached) | Free tier |
| VPS | Hetzner / DigitalOcean | Server hosting | Check provider BAA availability | $20–40/month |

**Total estimated pilot infrastructure cost: $25–50/month.**

**BAA action items before go-live:**
- [ ] Execute BAA with Resend at resend.com/dpa
- [ ] Execute BAA with Twilio at twilio.com/legal/agreements
- [ ] Execute BAA with Sentry at sentry.io/legal/dpa/
- [ ] Configure Sentry `beforeSend` PII scrubbing (required for any BAA compliance)
- [ ] Confirm VPS provider BAA availability (Hetzner does not offer BAA — use DigitalOcean or Linode if required)

---

## 19. Environment Variables

All environment variables are validated by Zod in `config/env.ts` at startup. Missing required variables cause an immediate process exit with a clear error message. Missing optional variables log a stub-mode warning.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3000` | API server port |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string. Must include `?sslmode=require` for encrypted API→DB connections. Fail fast if absent. |
| `JWT_SECRET` | **Yes** | — | Access token signing secret. Minimum 64 random characters. |
| `JWT_REFRESH_SECRET` | **Yes** | — | Refresh token signing secret. Must differ from `JWT_SECRET`. Minimum 64 characters. |
| `MFA_ENCRYPTION_KEY` | **Yes** | — | AES-256-GCM key for encrypting `mfa_secret` at the application level. 32-byte hex string (64 characters). Generate with `openssl rand -hex 32`. |
| `ALLOWED_ORIGINS` | **Yes** | — | Comma-separated list of allowed CORS origins. |
| `RESEND_API_KEY` | No | — | If absent: emails log to console in dev, throw in production. |
| `TWILIO_ACCOUNT_SID` | No | — | If absent: SMS logs to console in dev, throw in production. |
| `TWILIO_AUTH_TOKEN` | No | — | Twilio auth token. |
| `TWILIO_PHONE_NUMBER` | No | — | Twilio sending phone number. |
| `FIREBASE_PROJECT_ID` | No | — | Firebase project name. If absent: push logs to console in dev, throw in production. |
| `FIREBASE_CLIENT_EMAIL` | No | — | Firebase service account client email. |
| `FIREBASE_PRIVATE_KEY` | No | — | Firebase service account private key. |
| `STORAGE_DRIVER` | No | `local` | `local` or `s3` |
| `UPLOAD_DIR` | No | `./uploads` | Local file storage base path. Used when `STORAGE_DRIVER=local`. |
| `S3_BUCKET` | No | — | S3 bucket name. Required when `STORAGE_DRIVER=s3`. |
| `S3_REGION` | No | — | S3 region. Required when `STORAGE_DRIVER=s3`. |
| `CLOUDFRONT_URL` | No | — | CloudFront distribution URL for signed file URLs. |
| `APP_URL` | No | `http://localhost:8081` | Frontend app URL. Used in email links and CORS. |
| `API_URL` | No | `http://localhost:3000` | API base URL. Used in file URL construction. |
| `SENTRY_DSN` | No | — | Sentry DSN. If absent: errors only logged locally. |
| `LOG_LEVEL` | No | `info` | pino log level: `debug`, `info`, `warn`, `error`. Set to `debug` in development for SQL query logging. |
| `BACKUP_PASSPHRASE` | No | — | GPG symmetric passphrase for encrypting `pg_dump` backups (pilot only). Store separately from `.env` in production. |

---

## 20. Build Order — Sprint Plan

Six 1-week sprints. Each sprint produces independently deployable and testable output. No sprint depends on unfinished work from a previous sprint.

### Sprint 1 — Foundation + Auth (Week 1)

**Goal:** A working API with full authentication. Deployable to VPS.

1. Create full monorepo structure and npm workspaces. Set up `packages/shared` with Zod schemas.
2. Define all Drizzle schema files in `src/db/schema/`. Run `drizzle-kit generate` to produce migration SQL. Run `drizzle-kit migrate` to apply. Verify all tables with `\dt` in psql.
3. Build `config/env.ts`, `config/constants.ts`, `config/database.ts` (Drizzle client + connection pool), `config/logger.ts` (pino), `config/container.ts` (DI container).
4. Build all middleware: `errorHandler.ts`, `rateLimiter.ts`, `validate.ts` (Zod + sanitisation), `auth.ts`, `audit.ts`, `requestLogger.ts` (pino-http).
5. Build all utils: `jwt.ts`, `hash.ts`, `pagination.ts`, `sanitise.ts`.
6. Build `services/email.ts` with Resend + all email templates (stub mode if no key).
7. Build `services/sms.ts` with Twilio (stub mode if no credentials).
8. Build `routes/auth.ts` — all 15 auth endpoints (including `/auth/resend-verify-email`). Wire via DI container.
9. Write `index.ts`, wire all middleware and mount all routes via container. Expose `/health` endpoint.
10. Set up test infrastructure: `tests/helpers/testContainer.ts`, `tests/helpers/factories.ts`. Write basic middleware chain integration tests.
11. Deploy to VPS. Verify `/health` returns 200. Verify a full register → verify → login → refresh → logout cycle.

### Sprint 2 — Patient Core (Week 2)

**Goal:** Patient can log symptoms, view exercises, and manage their profile.

1. Build `routes/patients.ts` — profile CRUD, sessions.
2. Build `routes/symptoms.ts` — create, list, edit (24h window), calendar view.
3. Build `routes/exercises.ts` — patient-facing assignment list and completion marking.
4. Build `routes/notifications.ts` — list, mark read, mark all read.
5. Build `routes/reminders.ts` — full CRUD.
6. Extract any reused Drizzle queries to `db/queries/patients.queries.ts`, `db/queries/symptoms.queries.ts`.
7. Test: full symptom logging flow. Test: edit blocked after 24h. Test: calendar view aggregation.

### Sprint 3 — Provider Core (Week 3)

**Goal:** Provider can manage their patients, upload exercises, and assign work.

1. Build `routes/providers.ts` — profile, patient dashboard, patient detail view.
2. Build `routes/exercises.ts` — provider CRUD for exercise library.
3. Build `services/storage.ts` — StorageDriver interface, LocalDriver implementation.
4. Build `routes/uploads.ts` — video, avatar, report photo uploads with multer.
5. Build provider assignment endpoints (create/update/delete assignments).
6. Test: full exercise upload → create exercise → assign to patient → patient sees it.

### Sprint 4 — Reports + Linking (Week 4)

**Goal:** Patient-provider reporting and linking workflows are complete.

1. Build `routes/reports.ts` — patient submission, provider inbox (urgency sort + filters), response, review, flag.
2. Build `routes/linking.ts` — invite code generation, code listing, email invite, patient acceptance, disconnection.
3. Build `services/push.ts` with FCM (stub mode if no credentials).
4. Build `services/notify.ts` — unified dispatcher.
5. Wire `notify()` into all relevant route handlers (report submitted, report responded, exercise assigned, link accepted).
6. Test: full linking flow: generate code → patient accepts → both notified. Test: report urgency sorting. Test: internal_notes never returned to patient.

### Sprint 5 — Notifications + Jobs + Admin (Week 5)

**Goal:** Scheduled notifications work. Admin dashboard user management is live.

1. Build `jobs/reminderJob.ts`, `jobs/codeExpiryJob.ts`, `jobs/weeklyDigestJob.ts`, `jobs/cleanupJob.ts`, `jobs/orphanFileCleanupJob.ts`.
2. Register all jobs in `jobs/index.ts`.
3. Build `routes/admin.ts` — user list, user detail, user update, audit log viewer (with CSV export), login events, basic stats.
4. Test: reminder fires at correct time and day. Test: expired codes cleaned up. Test: cleanupJob does not touch audit_logs. Test: admin CSV export correct.

### Sprint 6 — Polish + Hardening + Ship (Week 6)

**Goal:** Production-ready pilot. Real users can onboard.

1. Full end-to-end testing of all flows in the testing checklist (Section 21).
2. Security hardening pass: verify all Helmet headers, CORS whitelist, rate limits behave correctly.
3. Verify all audit log entries are created correctly for every PHI route.
4. Performance: explain/analyze all slow queries. Add missing indexes if needed.
5. Configure Sentry with PII scrubbing `beforeSend` hook.
6. Write deployment runbook in `docs/RUNBOOK.md`.
7. Configure GitHub Actions: test → build → push to GHCR → deploy to VPS via SSH.
8. Deploy to VPS. Run full test checklist against production. Onboard 3–5 pilot providers.
9. **API documentation:** Auto-generate OpenAPI 3.1 spec from `packages/shared` Zod schemas using `zod-to-openapi`. Serve at `/docs` via Swagger UI (dev/staging only) or export as static JSON for provider integration partners.
10. **Load testing:** Run a `k6` script against the staging environment before go-live. Target: 50 concurrent virtual users, sustained for 5 minutes. Verify p95 response time < 200ms for reads and < 500ms for writes. Script lives in `tests/load/`.

> **Note on offline support:** Mobile offline queueing (Expo SQLite) is a post-MVP feature. Do not implement in Sprint 6. Log it as a backlog item for after pilot validation.

---

## 21. Testing Checklist

### Authentication

- [ ] Patient registration with all validations (email, password complexity, duplicate email)
- [ ] Email verification with 6-digit code (correct, wrong, expired)
- [ ] Resend verification email endpoint works (new code generated, old code invalidated)
- [ ] 5 failed verification code attempts invalidates the code
- [ ] Patient login → access + refresh tokens issued
- [ ] Provider registration with professional field validation
- [ ] Registration is transactional — partial failure leaves no orphaned rows
- [ ] Provider MFA setup: TOTP QR code generation and verification
- [ ] Provider login → mfa_required response → TOTP verify → full tokens issued
- [ ] Provider SMS MFA fallback
- [ ] MFA backup code usage — code marked used, cannot be reused
- [ ] Refresh token rotation — old token rejected after rotation
- [ ] Refresh token reuse detection — all family tokens invalidated on reuse
- [ ] Logout (single device) — refresh token deleted
- [ ] Logout all devices — all tokens and sessions deleted
- [ ] Password change — requires current password
- [ ] Forgot password → email with link → reset password → all sessions invalidated
- [ ] Account lockout after 5 failed attempts in 30 min — account_locked email sent
- [ ] Locked account rejects further login attempts
- [ ] New device login email alert
- [ ] Provider 15-min session timeout → SESSION_TIMEOUT response
- [ ] Patient not subject to session inactivity timeout

### Patient Features

- [ ] View own profile
- [ ] Update profile fields
- [ ] Soft delete account
- [ ] View assigned exercises (active only)
- [ ] Mark exercise complete — completion recorded
- [ ] Create symptom log with all fields (pain_level, pain_types, body_areas, duration_minutes, triggers, notes)
- [ ] Edit symptom log within 24h — succeeds
- [ ] Edit symptom log after 24h — rejected at database level (trigger enforced)
- [ ] Symptom log duplicate on same day uses upsert (ON CONFLICT DO UPDATE)
- [ ] Symptom calendar view — correct day-level aggregations
- [ ] Submit report to linked provider
- [ ] Submit urgent report — all 4 notification channels triggered
- [ ] View own report history
- [ ] View report detail — includes provider response — never includes internal_notes
- [ ] Notification list with unread count
- [ ] Mark notification read
- [ ] Mark all notifications read
- [ ] Create / update / delete reminder
- [ ] Accept provider invite code — link created — both parties notified
- [ ] Cannot accept a code that is expired
- [ ] Cannot accept a code that is already connected

### Provider Features

- [ ] View linked patient dashboard with stats
- [ ] Unlinked patient is not visible in dashboard
- [ ] View patient detail (tabs: symptoms, exercises, reports)
- [ ] Upload exercise video (MP4, MOV — over 100MB rejected — wrong MIME type rejected)
- [ ] Create exercise with details
- [ ] Assign exercise to linked patient — patient notified
- [ ] Cannot assign exercise to unlinked patient
- [ ] Report inbox sorted by urgency then date
- [ ] Filter report inbox by status, patient, date range
- [ ] Respond to report — patient notified
- [ ] Mark report as reviewed
- [ ] Flag / unflag report
- [ ] Generate invite code — 6 alphanumeric chars
- [ ] Code expires after 7 days
- [ ] Send email invite to patient email
- [ ] View code status (pending / connected / expired)
- [ ] Disconnect patient — link soft-deleted
- [ ] Re-linking same patient after disconnect works
- [ ] Provider can respond to same report multiple times — multiple response rows stored

### Security & HIPAA

- [ ] Rate limiting blocks login after threshold
- [ ] Rate limiting blocks MFA after threshold
- [ ] Rate limiting blocks email verification brute force (5 failed attempts invalidates code)
- [ ] Invalid JWT returns 401
- [ ] Expired JWT returns 401
- [ ] Wrong role returns 403
- [ ] Parameterized query blocks SQL injection attempt
- [ ] Oversized file upload rejected
- [ ] Wrong MIME type upload rejected
- [ ] MIME type spoofing (wrong Content-Type header with legitimate file bytes) handled correctly
- [ ] Audit log created for every PHI-touching route
- [ ] audit_logs UPDATE/DELETE rejected at database level
- [ ] cleanupJob hard-delete does not delete audit_log rows
- [ ] cleanupJob aborts when >50 accounts match (safety guard)
- [ ] cleanupJob sets reports.provider_id to NULL before hard-deleting provider users
- [ ] Deleted user's audit logs have user_id = NULL but rows remain
- [ ] Provider session timeout enforced at 15 minutes
- [ ] Admin session timeout enforced at 15 minutes
- [ ] Patients are not subject to session timeout
- [ ] internal_notes never returned in any patient-facing response
- [ ] mfa_secret is encrypted at rest (AES-256-GCM) — verified by inspecting raw DB value
- [ ] Database connection uses SSL (sslmode=require)
- [ ] pg_dump backup is GPG-encrypted
- [ ] X-Request-ID header present on all responses
- [ ] Orphan file cleanup removes unreferenced files older than 7 days
- [ ] Exercise completion duplicate on same day rejected (unique constraint)
- [ ] Patient re-linking after disconnect works (partial unique index)
- [ ] HTML/script tags in free-text fields are stripped by sanitisation middleware
- [ ] Stored XSS attempt in symptom notes — HTML stripped before storage, rendered as plain text in portal
- [ ] Docker container runs as non-root user (USER node)
- [ ] Structured JSON logs include requestId on every entry
- [ ] pino redact option strips password/token/code from log output
- [ ] Idempotency key on report submission — duplicate POST returns original response
- [ ] DI container stubs work in tests — no real email/SMS/push sent during test runs
- [ ] Symptom log edit window enforced by DB trigger — cannot bypass via direct SQL
- [ ] Scoped query helper prevents patient A from seeing patient B's data
- [ ] Rate limit state persists across API restart (pg store)
- [ ] Reminder fires at correct pre-computed `next_fire_at` time
- [ ] `logged_at` rejected if more than 24h in the past or in the future
- [ ] Paginated list response includes `{ data: [], meta: { total, page, limit, hasMore } }` (offset) or `{ data: [], meta: { limit, nextCursor, hasMore } }` (cursor)
- [ ] Cursor-based pagination on symptom_logs returns correct nextCursor
- [ ] Backup restore drill: encrypted pg_dump restores correctly to test DB
- [ ] Login timing: user-not-found path takes same time as wrong-password path (dummy bcrypt)
- [ ] Request timeout: handler exceeding 30s returns 408
- [ ] CSRF: state-changing request without `X-Requested-With` header returns 403
- [ ] Upload filenames are UUIDs — original client filename is not stored
- [ ] Graceful shutdown: in-flight request completes after SIGTERM sent
- [ ] Docker log rotation: container logs do not exceed 50 MB
- [ ] Job advisory lock: concurrent job invocations do not overlap

### Admin

- [ ] Dashboard stats are accurate
- [ ] User list search by email and name
- [ ] User list filter by role and status
- [ ] Activate / deactivate user
- [ ] Audit log viewer with date range filter
- [ ] Audit log CSV export — correct columns, correct date range — max 90 days enforced
- [ ] Login events list with failure reasons
- [ ] Admin MFA is mandatory — login requires TOTP verification
- [ ] Admin session timeout at 15 minutes

---

## 22. Decisions & Actions Required

| # | Decision / Action | Owner | Required By |
|---|---|---|---|
| 1 | Choose and provision VPS (DigitalOcean recommended — BAA available) | AQION TECH | Week 1 |
| 2 | Confirm DNS access for tmjconnect.com on Cloudflare | OROFACIAL | Week 1 |
| 3 | Create Resend account + verify sending domain `mail.tmjconnect.com` | AQION TECH | Week 1 |
| 4 | Create Twilio account + purchase a US phone number | AQION TECH | Week 1 |
| 5 | Create Firebase project for FCM. Download service account JSON. | AQION TECH | Week 1 |
| 6 | Generate `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `MFA_ENCRYPTION_KEY` — all 64+ character random hex strings | AQION TECH | Week 1 |
| 7 | Execute BAA with Resend | OROFACIAL + AQION TECH | Before go-live |
| 8 | Execute BAA with Twilio | OROFACIAL + AQION TECH | Before go-live |
| 9 | Execute BAA with Sentry + configure PII scrubbing | AQION TECH | Before go-live |
| 10 | Confirm DigitalOcean BAA availability for HIPAA hosting | AQION TECH | Week 1 |
| 11 | Provide Apple Developer + Google Play credentials for mobile app | OROFACIAL | Week 4 |
| 12 | Provide Terms of Service + Privacy Policy content (legal review required) | OROFACIAL | Before go-live |
| 13 | Provide Emergency Disclaimer text for urgent report submission (medical review required) | Medical Founder | Before go-live |
| 14 | Confirm 3–5 pilot providers for beta testing (Week 5 onboarding) | OROFACIAL | Week 5 |
| 15 | Decide: LUKS full-disk encryption on VPS. Must be set up at provisioning time. | AQION TECH | Week 1 |
| 16 | Document incident response procedure per Section 14.8. Assign on-call contacts. | OROFACIAL + AQION TECH | Before go-live |
| 17 | Configure GPG backup encryption for `pg_dump` output on VPS | AQION TECH | Week 1 |

---

## 23. Changelog from v2.0

The following issues identified in the v2.0 review have been corrected in this document:

| Issue | Severity | Resolution in v3.0 |
|---|---|---|
| `audit_logs` FK cascade would delete audit rows on user hard-delete | **Critical (HIPAA)** | FK changed to `ON DELETE SET NULL`. Audit rows are retained with `user_id = NULL`. `cleanupJob` explicitly prohibited from touching `audit_logs`. 6-year retention documented. |
| `refresh_tokens` table missing from schema | **Critical** | Full table definition added to Section 6.2 including `token_family` for reuse detection. |
| `password_resets` table missing from schema | **High** | Full table definition added to Section 6.2. |
| No refresh token reuse detection | **Medium** | Token family tracking added. Reuse of a rotated token invalidates all tokens in the family. Documented in Section 7.6. |
| `updated_by` column claimed but never defined | **Medium** | Removed claim. Audit middleware approach makes `updated_by` redundant. |
| ffmpeg dependency undeclared | **Medium** | ffmpeg removed. Thumbnails are provider-uploaded separately. No server-side processing for MVP. |
| `symptom_logs` missing fields from v1 | **Medium** | All fields restored: `pain_types`, `duration_minutes`, `triggers`, `updated_at`. |
| `notification_preferences` missing `report_updates` and `email_digest` fields | **Medium** | Both fields restored to schema definition. |
| SSE vs polling unresolved | **Low** | Polling every 30 seconds chosen for MVP. SSE deferred post-MVP. |
| Sprint 6 over-packed (offline support) | **Low** | Offline support explicitly deferred to post-MVP backlog. |
| Sentry PII scrubbing not specified | **Medium** | `beforeSend` hook with required scrubbed fields documented in Section 9.5. |
| Certificate pinning operational risk | **Low** | Noted as post-go-live addition in Section 14.1. |
| Migration versioning absent | **Medium** | Numbered SQL migration files added with `schema_migrations` tracking table. |
| `login_events` would cascade-delete on user hard-delete | **Medium** | FK changed to `ON DELETE SET NULL`. Login events retained for security monitoring. |
| No `queries/` folder separation rationale | **Low** | `db/queries/` folder documented with clear rule: extract to queries file when used by more than one route. |
| DB permissions not specified | **High (HIPAA)** | Section 6.10 added: `tmjconnect_api` role with UPDATE/DELETE revoked on `audit_logs` and `login_events`. |

### Changes introduced in v3.1

| Change | Rationale |
|---|---|
| Added Drizzle ORM to tech stack | SQL-first ORM. Type-safe queries, auto-generated TypeScript types from schema, auto-diffed migrations via `drizzle-kit`. No HIPAA impact — all queries parameterized by default. Inspectable generated SQL. |
| Replaced `queries/` folder with `db/schema/` + `db/queries/` | Schema definitions now live in `db/schema/` as Drizzle table objects. Reused queries live in `db/queries/`. Inline queries remain in route files for single-use cases. |
| Removed custom `migrate.ts` runner | Replaced by `drizzle-kit migrate`. Migration history tracked in `__drizzle_migrations`. Generated SQL files in `drizzle/migrations/` are committed to the repo. |
| Removed manual `schema_migrations` SQL table | Drizzle manages its own `__drizzle_migrations` tracking table automatically. |
| Updated coding principle #2 | Raw `$1,$2` SQL style replaced with Drizzle query builder. `sql` tagged template permitted for complex expressions — bound parameters enforced. |

### Changes introduced in v3.2

| Change | Gap # | Resolution |
|---|---|---|
| Database backup encryption specified | Critical #1 | `pg_dump` output encrypted with GPG (AES-256). `BACKUP_PASSPHRASE` env var added. Section 14.1. |
| API→DB connection encryption required | Critical #2 | `DATABASE_URL` must include `?sslmode=require`. Documented in Section 14.1 and Section 19. |
| PHI data classification table added | Critical #3 | Section 14.7 lists every PHI column across all tables with derived rules for audit metadata, Sentry scrubbing, and cleanup. |
| Incident response procedure documented | Critical #4 | Section 14.8: containment within 1h, investigation within 24h, notification within 60d. Roles assigned. |
| `cleanupJob` safety guard added | Critical #5 | Abort + Sentry alert if >50 accounts match. Row count logged on every run. Section 12. |
| `profiles.timezone` column added | High #6, #7 | IANA timezone stored per user. Reminder job and weekly digest use it. |
| Registration wrapped in transaction | High #8 | Steps 4–10 are inside `db.transaction()`. Documented in Section 7.1. |
| `reports.provider_id` FK changed to `ON DELETE SET NULL` | High #9 | `cleanupJob` sets NULL on reports before hard-delete. No more FK violation. |
| `/auth/resend-verify-email` endpoint added | High #10 | Rate-limited to 1 per 2 min per email. Generates new code. Added to route map. |
| Admin MFA + session timeout documented | High #11 | Section 13.0: same flow as providers. 15-min timeout. |
| `mfa_secret` encrypted at application level | High #12 | AES-256-GCM via `MFA_ENCRYPTION_KEY`. Column changed to TEXT. |
| Admin CSV export max 90-day range | Medium #13 | Enforced in route description. Response streamed. |
| `orphanFileCleanupJob` added | Medium #14 | Daily 4 AM. Deletes unreferenced files >7 days old. Section 12. |
| `patient_provider_links` partial unique index | Medium #15 | `UNIQUE WHERE unlinked_at IS NULL`. Re-linking after disconnect now works. |
| `notify()` DB INSERT failure handling specified | Medium #16 | Failures logged to Sentry, not propagated. Notification considered lost. |
| `X-Request-ID` correlation added | Medium #17 | UUID per request. In audit metadata, error responses, Sentry tags. Section 15.1. |
| Health check `/health` specified | Medium #18 | Runs `SELECT 1`. Returns 503 if DB is down. Section 15.5. |
| Cron-in-same-process limitation documented | Medium #19 | Noted as known pilot limitation. Production path: separate worker process. |
| Email verification rate limiting added | Low #20 | 5 requests/15 min tier. 5 failed attempts invalidates code. |
| Linking code retry logic documented | Low #21 | Up to 3 retries on unique constraint violation. |
| `exercise_completions` daily duplicate guard | Low #22 | Unique index on `(assignment_id, patient_id, DATE(completed_at))`. |
| Multiple report responses clarified | Low #23 | Multiple rows allowed. Patient sees all in chronological order. |
| API versioning deprecation strategy added | Low #24 | `Sunset` header, 6-month overlap, `410 Gone` after sunset. |

### Changes introduced in v3.3

| Change | Gap # | Resolution |
|---|---|---|
| **DI container pattern added** | SE #1 | `config/container.ts` wires all dependencies at startup. Route handlers receive container as argument — never import services directly. No module depends on another. (Section 3.3) |
| **Idempotency strategy added** | SE #2 | Natural deduplication via DB constraints (preferred) + `Idempotency-Key` header for non-unique operations. `idempotency_keys` table added to schema. `codeExpiryJob` cleans expired keys. (Section 3.4) |
| **Input sanitisation added** | SE #3 | `isomorphic-dompurify` strips HTML from free-text fields after Zod validation. `sanitise.ts` utility. `validate.ts` middleware updated. (Section 3.5) |
| **Structured logging with pino** | SE #4 | `pino` + `pino-http` replace all `console.log`. JSON logs with `requestId`, `level`, `responseTime`. HIPAA-safe `redact` config. `config/logger.ts` factory function. (Section 3.6) |
| **Testability by design** | SE #5 | Test container with in-memory stubs. Test DB lifecycle (migrate → truncate → cleanup). Test data factories. No mocking libraries. `tests/` folder structure added. (Section 3.7) |
| **Graceful degradation documented** | SE #6 | Behaviour for every external dependency failure specified. Startup dependency checks. API starts even if email/SMS/push are unreachable. (Section 3.8) |
| **Connection pooling configured** | SE #7 | `pg.Pool` with explicit `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`. Pilot vs production values. Added to Section 6.1. |
| **Contract-first API types** | SE #8 | `packages/shared` structure documented with Zod schemas exported as the API contract. Frontend and backend share types — compilation fails on contract drift. (Section 5.3) |
| **Immutability enforced at DB level** | SE #9 | `symptom_logs` 24-hour edit window enforced via `BEFORE UPDATE` trigger — not just route handler logic. (Section 6.7) |
| **Least privilege (beyond DB)** | SE #10 | Docker non-root user, scoped S3 IAM policy, Firebase minimal permissions, GitHub Actions restricted permissions, VPS SSH hardening. (Section 14.9) |
| **Observability & metrics** | SE #11 | Request metrics via pino-http, Sentry P0/P1/P2 alert tiers, production CloudWatch dashboard plan. (Section 14.10) |
| **Coding principles expanded** | SE #12 | Added rules #11 (sanitise free-text), #12 (idempotent writes), #13 (structured logging). Updated rule #1 for DI container. Updated rule #4 and #6 for DI/stub patterns. |
| **`LOG_LEVEL` env var added** | SE #13 | pino log level configuration. Default `info`. Set `debug` for SQL logging in dev. |
| **Symptom log daily upsert** | SE #14 | One log per patient per day via `ON CONFLICT DO UPDATE` using natural deduplication. |
| **`pino` and `isomorphic-dompurify` added to tech stack** | SE #15 | New dependencies documented in Section 2. |
| **Sprint 1 updated** | SE #16 | Added `container.ts`, `logger.ts`, `sanitise.ts`, `requestLogger.ts`, shared schemas, test infrastructure to Sprint 1 deliverables. |
| **Testing checklist expanded** | SE #17 | Added 10 new test items: sanitisation, XSS prevention, non-root Docker, structured logs, idempotency, DI stubs, DB trigger enforcement. |

### Changes introduced in v3.4

Based on external architecture review. 9 fixes applied, 3 pilot limitations documented.

| Change | Review # | Resolution |
|---|---|---|
| **`next_fire_at` column added to `reminders`** | Review #1 | Pre-computed UTC fire time. `reminderJob` now queries `WHERE next_fire_at <= NOW() AND enabled = true` — no per-row timezone math at runtime. Recalculated after each fire and on any schedule change. Index added. (Section 6.6, Section 12) |
| **`next_digest_at` column added to `notification_preferences`** | Review #2 | Pre-computed UTC time for weekly digest. `weeklyDigestJob` queries `WHERE next_digest_at <= NOW()` — same pattern as reminders. Index added. (Section 6.6, Section 12) |
| **Rate limiter switched to PostgreSQL store** | Review #3 | `@express-rate-limit/pg` store added. Rate limit counters persist across deploys/restarts — no more bypass by waiting for deploy. (Section 2, Section 14.3) |
| **`notify()` logs lost notifications to pino** | Review #4 | On DB INSERT failure, full notification payload written to structured pino log tagged `notification_lost`. Makes lost notifications recoverable from log aggregation. (Section 9.1) |
| **`logged_at` backdating hole fixed** | Review #5 | Zod validation constrains `logged_at` to ±24 hours. Edit window trigger anchored to `created_at` (server-set, immutable) instead of `logged_at` (client-provided). (Section 6.5, Section 6.7) |
| **Pagination response shape specified** | Review #6 | `{ data: T[], meta: { total, page, limit, hasMore } }` for all list endpoints. Offset-based for MVP. `parsePagination()` utility documented. (Section 15.4) |
| **Mobile token storage specified** | Review #7 | Expo `SecureStore` for access + refresh tokens on mobile. Required for HIPAA — plaintext storage is a compliance violation. (Section 7.6) |
| **Row-level access control (`scopeToUser`)** | Review #8 | `scopedQuery.ts` utility auto-injects ownership WHERE clauses based on authenticated user's role. Prevents PHI leakage from a missed WHERE clause. (Section 3.9, Section 14.4) |
| **Backup restore verification added** | Review #9 | Monthly restore drill: restore encrypted `pg_dump` to test DB, verify row counts. Added to NFR table and testing checklist. (Section 17) |
| **Refresh token family scan — pilot limitation documented** | Review #10 | Second query on token miss is acceptable at 50 users. Production path: in-memory TTL map of revoked families or `revoked_families` table. (Section 7.6) |
| **Orphan file cleanup scaling — pilot limitation documented** | Review #11 | Filesystem walk approach works for pilot. Production path: `file_uploads` tracking table with `referenced` boolean. (Section 12) |
| **Testing checklist expanded** | Review #12 | 7 new test items: scoped queries, rate limit persistence, reminder `next_fire_at`, `logged_at` validation, pagination response shape, backup restore drill. |

### Changes introduced in v3.5

Based on second external architecture review. 2 bugs fixed, 10 fixes applied, 4 additions, 3 clarifications.

| Change | Review # | Resolution |
|---|---|---|
| **`weeklyDigestJob` cron fixed** | Bug #12 | Changed from `0 * * * 0` (Sundays only) to `0 * * * *` (every hour, every day). The cron must run every hour because `next_digest_at` is pre-computed per user's timezone — the cron itself has no day-of-week logic. (Section 12) |
| **Login timing attack mitigated** | Bug #6 | Added dummy `bcrypt.compare` on user-not-found path in Login Flow step 2. Prevents timing-based account enumeration. (Section 7.4) |
| **Job locking via `pg_advisory_lock`** | Fix #1 | Every job acquires a PostgreSQL advisory lock inside a transaction before executing. Prevents overlapping runs. Job lock IDs defined in `config/constants.ts`. (Section 12) |
| **Request timeout middleware added** | Fix #2 | `requestTimeout.ts` middleware aborts requests after 30 seconds with `408 Request Timeout`. Added to middleware chain before `rateLimiter`. (Section 5.2, middleware chain) |
| **`cleanupJob` per-user transaction** | Fix #4 | Each user's cleanup (SET NULL → anonymise → hard-delete) runs inside its own `db.transaction()`. A single-user failure logs to Sentry and continues — does not abort the batch. (Section 12) |
| **Circuit breaker on external services** | Fix #5 | Each service wrapper tracks consecutive failures. After 5 failures, breaker opens for 60 seconds (skip all calls). Half-open state resumes after timeout. (Section 3.8) |
| **CSRF protection strategy** | Fix #7 | `SameSite=Lax` cookies + mandatory `X-Requested-With: XMLHttpRequest` header on state-changing requests. No CSRF tokens needed for a JSON API with CORS. (Section 14.6.1) |
| **Idempotency-key PHI leak fixed** | Fix #8 | `response_body` now stores only `{ status, resourceId }` — never the full response body. Replay re-fetches via normal code path with access controls. PHI classification table updated. (Section 3.4, Section 6.1.1, Section 14.7) |
| **UUID filenames for uploads** | Fix #9 | `multer` configured with `crypto.randomUUID()` filename generator. Original client filename is never used. Prevents path traversal and filename collisions. (Section 10.2) |
| **Cursor-based pagination for mobile** | Fix #10 | `symptom_logs` and `notifications` use cursor-based pagination (`WHERE logged_at < :cursor`). Admin/dashboard tables remain offset-based. `parseCursorPagination()` utility added. (Section 15.4) |
| **Graceful shutdown handler** | Fix #13 | SIGTERM handler in `index.ts`: stop accepting → drain in-flight (5s) → close pool → exit 0. Zero dropped requests on deploy. (Section 16.1) |
| **Docker log rotation** | Fix #17 | `logging` block with `max-size: 10m`, `max-file: 5` on all Docker Compose services. Caps at 50 MB per container. (Section 16.1) |
| **Migration rollback strategy** | Addition #14 | Fix-forward approach with pre-deploy `pg_dump` schema snapshots. Emergency rollback documented. (Section 6.1.2) |
| **API documentation plan** | Addition #15 | Auto-generate OpenAPI 3.1 from `packages/shared` Zod schemas using `zod-to-openapi`. Added to Sprint 6. (Section 20) |
| **Load testing plan** | Addition #16 | `k6` script against staging before go-live. 50 VUs, 5 minutes, p95 targets. Added to Sprint 6. (Section 20) |
| **6-digit code brute-force math documented** | Addition #11 | 900,000 code space ÷ 5 attempts = 0.00056% probability. Combined with rate limiting, automated brute-force is infeasible. (Section 7.1) |
| **Orphan cleanup race condition fixed** | Clarification #3 | Changed from per-file DB lookup to single-query approach (collect all referenced URLs as a Set, then walk filesystem). Eliminates TOCTOU race condition. (Section 12) |
| **Provider exercise text fields documented as plain text** | Nit #1 | `description` and `instructions` are deliberately plain text for MVP. Sanitisation still runs (single code path). Rich text is post-MVP. (Section 6.4) |
| **`sessions` vs `refresh_tokens` rationale documented** | Nit #2 | Different purposes: sessions = UI display + timeout. Refresh tokens = rotation + reuse detection. Merging would conflate logic. (Section 6.2) |

---

*Prepared by AQION TECH | Confidential | April 2026*

*Version 3.0 supersedes all previous versions of the TMJConnect System Architecture & Technical Design document.*
