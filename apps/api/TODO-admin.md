# Admin App — Pending Features

This file tracks every admin-app feature that requires **backend changes** to ship. Frontend-only features should not live here — implement them directly.

Each entry includes:
- **Why** — the problem it solves
- **Data sources** — existing tables / endpoints involved
- **New endpoints** — exact route shape, query params, response shape
- **Schema changes** — new tables / columns / migrations
- **Frontend integration notes** — what the UI looks like
- **Estimated effort** — backend / frontend split
- **Priority** — P0 (ship blocker), P1 (high impact), P2 (nice)

---

## P0 — Operational visibility for what we already built

### 1. Notification outbox monitor

**Why.** We just implemented the transactional outbox pattern but admins are blind to it. If Resend goes down, an admin can't see the queue depth, can't inspect the DLQ, can't replay failed messages. This is the highest-value visibility gap on the platform.

**Data sources.** [`apps/api/src/db/schema/notifications.ts`](src/db/schema/notifications.ts) — `notification_outbox` table.

**New endpoints.**

```
GET /admin/outbox/stats
→ {
    pending: number,                    // sent_at IS NULL AND attempts < max_attempts
    dlq: number,                        // sent_at IS NULL AND attempts >= max_attempts
    sent_24h: number,
    failed_24h: number,
    by_channel: {
      email: { pending: number, sent_24h: number, dlq: number },
      sms:   { pending: number, sent_24h: number, dlq: number },
      push:  { pending: number, sent_24h: number, dlq: number },
    },
    hourly_volume: Array<{ hour: string, sent: number, failed: number }>,  // last 24h
  }

GET /admin/outbox/dlq?page=1&limit=20&channel=email
→ { data: NotificationOutbox[], meta: { page, limit, total } }

GET /admin/outbox/pending?page=1&limit=20
→ same shape; only rows where sent_at IS NULL AND attempts < max_attempts

POST /admin/outbox/:id/retry
→ resets attempts=0, next_attempt_at=NOW(), last_error=NULL
→ audit: 'admin_outbox_retried'

DELETE /admin/outbox/:id
→ permanently drops a DLQ row
→ audit: 'admin_outbox_dropped'
```

**Schema changes.** None — `notification_outbox` already exists.

**Frontend.** New `/admin/outbox` page with:
- 4 KPI cards (pending / sent today / failed today / DLQ)
- Channel breakdown card (email/sms/push side-by-side)
- Hourly volume area chart (last 24h)
- Two tables: "Pending retries" and "Dead-letter queue"
- Per-row action buttons: Retry, Drop
- Dashboard widget: small "Outbox health" card linking to the page

**Effort.** Backend: 2h. Frontend: 3h.
**Priority.** P0.

---

### 2. Active sessions panel

**Why.** Admins should see who's currently online, force-logout suspicious sessions, and detect concurrent-login anomalies. We have the `sessions` table but it's invisible to the UI.

**Data sources.** [`apps/api/src/db/schema/auth.ts`](src/db/schema/auth.ts) — `sessions` table.

**New endpoints.**

```
GET /admin/sessions/active?page=1&limit=50&role=provider
→ {
    data: Array<{
      id: string,
      user_id: string,
      user_email: string,
      user_role: 'patient' | 'provider' | 'admin',
      ip_address: string | null,
      device_info: string | null,
      last_active: string,
      created_at: string,
    }>,
    meta: { page, limit, total },
    summary: {
      total_active: number,        // last_active > NOW() - 15min
      by_role: { patient: number, provider: number, admin: number },
    }
  }

DELETE /admin/sessions/:id
→ deletes the session row, forcing the user to re-login on their next request
→ audit: 'admin_session_terminated'
```

Active = `last_active > NOW() - 15 minutes`. The query joins `sessions` with `users`.

**Schema changes.** None.

**Frontend.** New `/admin/sessions` page:
- 3 KPI cards (total active / providers online / patients online)
- Live-updating table (auto-refresh every 30s) with columns: User, Role, IP, Device, Last active (relative), Actions
- "Force logout" icon button per row → confirm modal
- Dashboard widget: "X users online now" with role breakdown

**Effort.** Backend: 1h. Frontend: 2h.
**Priority.** P0.

---

### 3. Job runner health

**Why.** We have 6 cron jobs (`reminderJob`, `codeExpiryJob`, `weeklyDigestJob`, `cleanupJob`, `orphanFileCleanupJob`, `outboxJob`) and admins are completely blind to whether they're running. Today the only signal that a job has died is "users notice broken behavior."

**Data sources.** New `job_runs` table (does not exist).

**Schema changes.**

```sql
-- Migration: 0005_job_runs.sql
CREATE TYPE job_status AS ENUM ('running', 'success', 'failed', 'skipped');

CREATE TABLE job_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name      VARCHAR(50) NOT NULL,
  status        job_status NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  duration_ms   INTEGER,
  rows_affected INTEGER,         -- e.g. reminders fired, codes expired
  error_message TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_job_runs_name_started ON job_runs(job_name, started_at DESC);
CREATE INDEX idx_job_runs_status ON job_runs(status);
```

**Code changes.** Wrap the `withAdvisoryLock` runner in [`apps/api/src/jobs/index.ts`](src/jobs/index.ts) with a `recordJobRun` helper that:
1. Inserts a `running` row at start
2. Updates to `success` / `failed` / `skipped` (lock not acquired) at end
3. Catches and stores any error

**New endpoints.**

```
GET /admin/jobs
→ {
    data: Array<{
      job_name: string,
      schedule: string,         // cron expression
      last_run: { status, started_at, duration_ms, rows_affected, error_message } | null,
      last_success_at: string | null,
      success_rate_24h: number, // 0..1
      avg_duration_ms_7d: number,
    }>
  }

GET /admin/jobs/:name/history?page=1&limit=50
→ { data: JobRun[], meta }

POST /admin/jobs/:name/run
→ enqueues an out-of-band run of the named job (still respects advisory lock)
→ audit: 'admin_job_triggered'
→ 202 Accepted
```

**Frontend.** New `/admin/jobs` page:
- Table with all 6 jobs, status pill, last run, duration, success rate
- Click row → drawer with run history
- Manual trigger button per row
- Dashboard: 1 line in System Status panel — "Jobs: 6/6 healthy" (red if any failing)

**Effort.** Backend: 3h (migration + wrapper + 3 endpoints). Frontend: 2.5h.
**Priority.** P0.

---

### 4. Urgent reports waiting alert

**Why.** When a patient submits an urgent report, the provider gets notified — but if the provider is unresponsive, that report sits in the queue and admins should know about it. Today the only way to find these is to manually filter the reports page.

**Data sources.** `reports` table (existing).

**New endpoints.** Extend [`/admin/stats`](src/routes/admin.ts):

```
GET /admin/stats
→ {
    ...existing fields,
    urgent_reports_waiting: number,           // urgency='urgent' AND status='submitted' AND submitted_at < NOW() - 1h
    urgent_reports_waiting_critical: number,  // same but > 4h
    pending_reports_total: number,            // any status='submitted'
  }
```

Also extend `adminReportsQuerySchema` to accept `urgency` and `status` filters so admins can drill in:

```ts
export const adminReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  urgency: z.enum(['routine', 'concerning', 'urgent']).optional(),
  status: z.enum(['submitted', 'viewed', 'reviewed', 'responded']).optional(),
  unanswered_over_hours: z.coerce.number().int().min(1).optional(),
});
```

**Frontend.** Already has the dashboard KPI grid — add an "Urgent waiting" card with red tone when count > 0. Click → Reports page filtered by `urgency=urgent&status=submitted`. Topbar bell icon shows the count as a badge.

**Effort.** Backend: 1h. Frontend: 30min.
**Priority.** P0.

---

## P1 — Operational depth

### 5. Provider performance dashboard

**Why.** Today every provider looks the same to an admin. Surfacing "which providers are slow to respond" or "which providers haven't logged in for a week" helps catch attrition early.

**Data sources.** `users`, `profiles`, `provider_details`, `reports`, `report_responses`, `login_events`, `patient_provider_links`.

**New endpoints.**

```
GET /admin/providers/performance?page=1&limit=20&sort=avg_response_hours
→ {
    data: Array<{
      provider_id: string,
      name: string,
      email: string,
      patient_count: number,
      active_patients_7d: number,           // patients who logged a symptom in 7d
      reports_received_30d: number,
      reports_responded_30d: number,
      response_rate: number,                 // 0..1
      avg_response_hours: number | null,
      last_login_at: string | null,
      mfa_enabled: boolean,
    }>,
    meta: { page, limit, total },
  }

GET /admin/providers/:id/performance
→ same shape but a single provider with extra detail (per-day response time chart)
```

**Schema changes.** None. The aggregation is expensive — consider a materialised view refreshed nightly if it's slow on real data.

**Frontend.** New `/admin/providers` page:
- KPI cards (total providers / active providers / avg response time)
- Sortable table
- Click row → provider drawer with charts
- Dashboard: small "Provider attention" card if any provider's `last_login_at > 7d ago`

**Effort.** Backend: 2.5h (the join is non-trivial). Frontend: 3h.
**Priority.** P1.

---

### 6. Patient engagement & churn

**Why.** Most healthcare platforms lose patients silently. Admins need to know "who's dormant" to target re-engagement.

**Data sources.** `users`, `symptom_logs`, `exercise_completions`, `login_events`.

**New endpoints.**

```
GET /admin/patients/engagement?tier=dormant&page=1&limit=20
→ {
    data: Array<{
      patient_id: string,
      name: string,
      email: string,
      created_at: string,
      last_symptom_log_at: string | null,
      last_login_at: string | null,
      symptom_streak_days: number,
      exercise_completion_rate_30d: number,
      tier: 'highly_active' | 'occasional' | 'dormant' | 'never_active',
    }>,
    meta: { page, limit, total },
    summary: {
      highly_active: number,    // logged in last 7d AND symptom log last 7d
      occasional: number,       // logged in last 30d
      dormant: number,          // no activity > 30d
      never_active: number,     // no symptom log ever
    }
  }
```

**Frontend.** New `/admin/patients/engagement` page with the 4 tiers as KPIs and a tier-filtered table.

**Effort.** Backend: 2h. Frontend: 2h.
**Priority.** P1.

---

### 7. Security operations panel (SIEM-lite)

**Why.** We capture security events (`login_events`, refresh-token replays in `audit_logs`) but admins have no consolidated view. This is what an "InfoSec admin" wants.

**Data sources.** `login_events`, `audit_logs`.

**New endpoints.**

```
GET /admin/security/summary?window=24h
→ {
    failed_logins_24h: number,
    failed_logins_by_ip: Array<{ ip: string, count: number }>,
    failed_logins_by_email: Array<{ email: string, count: number }>,
    accounts_locked_now: number,
    refresh_token_replays_24h: number,    // count of audit_logs WHERE action LIKE '%token_replay%'
    new_device_logins_24h: number,
    hourly_failed_logins: Array<{ hour: string, count: number }>,
  }

GET /admin/security/alerts
→ {
    data: Array<{
      id: string,
      severity: 'low' | 'medium' | 'high' | 'critical',
      type: string,
      message: string,
      user_id: string | null,
      ip: string | null,
      created_at: string,
      acknowledged: boolean,
    }>
  }
```

**Schema changes.** Optional new `security_alerts` table for the second endpoint, OR derive on the fly from `login_events` + `audit_logs`. Start derived; promote to a table if it gets slow.

**Frontend.** New `/admin/security` page:
- 4 KPI cards (failed logins / locked accounts / replays / new devices)
- Hourly failed-login chart
- Two tables: "Top failure sources" and "Recent security events"
- Dashboard widget: "X security alerts" badge

**Effort.** Backend: 2h. Frontend: 3h.
**Priority.** P1.

---

### 8. Linking & relationships summary

**Why.** Admins should see how the patient/provider graph is shaped — pending invites, recently disconnected pairs, providers with the most patients.

**Data sources.** `patient_provider_links`, `linking_codes`.

**New endpoints.**

```
GET /admin/linking/summary
→ {
    active_links: number,
    disconnected_30d: number,
    pending_codes: number,
    expired_codes: number,
    top_providers: Array<{ provider_id: string, name: string, patient_count: number }>,
  }

GET /admin/linking/codes?status=pending&page=1&limit=20
→ paginated linking codes with provider name + status

GET /admin/linking/links?status=active&page=1&limit=20
→ paginated patient_provider_links with patient + provider names
```

**Frontend.** New `/admin/linking` page with KPIs + 2 tables (codes, links).

**Effort.** Backend: 1.5h. Frontend: 2h.
**Priority.** P1.

---

### 9. PHI access reports (HIPAA artifact)

**Why.** This is what an auditor will ask for: "Show me everything Dr. Smith accessed last month" or "Who accessed Patient X's record?". The data is already in `audit_logs` — just needs to be sliced usefully.

**Data sources.** `audit_logs`.

**New endpoints.**

```
GET /admin/phi-access/by-actor?user_id=...&from=2026-03-01&to=2026-04-01
→ {
    actor: { id, email, role },
    summary: {
      total_accesses: number,
      unique_resources: number,
      by_resource_type: Record<string, number>,
    },
    timeline: Array<{ date, count }>,
    details: Array<{ id, action, resource_type, resource_id, created_at }>
  }

GET /admin/phi-access/by-resource?resource_type=user&resource_id=...&from=...&to=...
→ {
    resource: { type, id },
    accesses: Array<{
      actor_id: string,
      actor_email: string,
      actor_role: string,
      action: string,
      ip_address: string,
      created_at: string,
    }>,
    unique_actors: number,
  }

GET /admin/phi-access/anomalies?window=24h
→ {
    bulk_listings: Array<{ actor_id, actor_email, count, window_start }>,  // > 20 list calls in 5min
    unusual_patient_views: Array<{ actor_id, patient_count, window_start }>, // viewing many patients quickly
  }
```

The anomaly detection is the differentiator — flag a provider who suddenly viewed 50 patient records in 5 minutes (data exfil pattern).

**Schema changes.** None.

**Frontend.** New `/admin/phi-access` page:
- Two tabs: "By actor" and "By resource"
- Form to select user / resource + date range
- Result view: summary stats + timeline chart + details table
- "Anomalies" sidebar always visible

**Effort.** Backend: 3h (anomaly detection is the bulk). Frontend: 4h.
**Priority.** P1 (HIPAA compliance value).

---

### 10. Notification preferences audit

**Why.** Admins should see what users have opted out of, and detect bounce/failure trends. Right now this lives in `notification_preferences` and is invisible.

**Data sources.** `notification_preferences`, `notification_outbox`.

**New endpoints.**

```
GET /admin/notifications/preferences-summary
→ {
    by_channel: {
      email_digest: { instant: number, daily: number, weekly: number, off: number },
      exercise_reminders: { on: number, off: number },
      symptom_checkin: { on: number, off: number },
      provider_messages: { on: number, off: number },
      report_updates: { on: number, off: number },
    },
    bounce_rate_24h: number,    // failed outbox rows / total
  }
```

**Frontend.** Section in the future Notification ops page.

**Effort.** Backend: 1h. Frontend: 1h.
**Priority.** P1.

---

## P2 — Power features

### 11. Global server-side search

**Why.** Cmd+K is implemented client-side first (see `GlobalSearch.tsx`), but it only matches what's already loaded. A real cross-entity full-text search needs a backend endpoint.

**New endpoints.**

```
GET /admin/search?q=jane&types=user,report,audit_log
→ {
    users: Array<{ id, email, name, role, score }>,
    reports: Array<{ id, patient_name, urgency, submitted_at, score }>,
    audit_logs: Array<{ id, action, resource_type, created_at, score }>,
  }
```

Use Postgres full-text search (`tsvector` columns) or `ILIKE '%q%'` for v1. Limit to 5 results per type.

**Schema changes.** Optional `tsvector` columns for users.email, profiles.first_name+last_name. Add GIN indexes.

**Frontend.** Replace the client-side search in the existing `GlobalSearch.tsx` with a debounced fetch.

**Effort.** Backend: 2h (without tsvector), 4h (with). Frontend: 30min (refactor).
**Priority.** P2.

---

### 12. Broadcast / announcements

**Why.** Admins need a way to push platform-wide messages: "Maintenance Saturday 2 AM", "New feature: ...", "Reminder: complete your MFA setup".

**Data sources.** Writes into `notifications` table (and goes through the outbox if email/push is enabled).

**New endpoints.**

```
POST /admin/broadcasts
{
  audience: 'all' | 'patients' | 'providers' | 'admins',
  type: 'system' | 'announcement',
  title: string,
  body: string,
  channels: ('in_app' | 'email')[],
  scheduled_at: string | null,    // null = send immediately
}
→ { broadcast_id: string, recipient_count: number }
→ audit: 'admin_broadcast_sent'

GET /admin/broadcasts?page=1&limit=20
→ history of past broadcasts
```

Implementation: enqueues N rows in `notifications` (one per matching user) and N rows in `notification_outbox` (if email channel chosen). The outbox job handles delivery.

**Schema changes.** Optional `broadcasts` table for the history endpoint, or aggregate from `audit_logs`.

**Frontend.** New `/admin/broadcasts` page with a compose form + history table.

**Effort.** Backend: 2h. Frontend: 3h.
**Priority.** P2.

---

### 13. System metrics (real infrastructure observability)

**Why.** API latency, DB pool utilization, memory, circuit breaker states. Today admins find out about API slowness from user complaints.

**Data sources.** `pg.Pool` (from container), `process.memoryUsage()`, `os.loadavg()`, the existing circuit breaker singletons in [`apps/api/src/services/circuitBreaker.ts`](src/services/circuitBreaker.ts).

**New endpoints.**

```
GET /admin/system/metrics
→ {
    api: {
      uptime_seconds: number,
      memory: { rss_mb, heap_used_mb, heap_total_mb },
      cpu_load_1m: number,
      pid: number,
      node_version: string,
    },
    db: {
      pool_total: number,        // pg.Pool.totalCount
      pool_idle: number,         // pg.Pool.idleCount
      pool_waiting: number,      // pg.Pool.waitingCount
    },
    circuit_breakers: {
      email: { state: 'closed' | 'open' | 'half_open', failure_count: number, last_failure_at: string | null },
      sms:   { ...same },
      push:  { ...same },
    }
  }
```

For request latency you'd need to wire `pino-http` to record into a small ring buffer (or expose `/metrics` for Prometheus). Out of scope for v1; static-snapshot endpoint is enough.

**Schema changes.** None.

**Frontend.** Section on a new `/admin/system` page or as a dashboard widget.

**Effort.** Backend: 1.5h. Frontend: 1.5h.
**Priority.** P2.

---

### 14. Scheduled exports & saved reports

**Why.** Compliance teams want "weekly audit log CSV emailed every Monday." Right now exports are manual one-offs.

**Data sources.** New table.

**Schema changes.**

```sql
CREATE TABLE scheduled_reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by  UUID NOT NULL REFERENCES users(id),
  name        VARCHAR(200) NOT NULL,
  entity      VARCHAR(50) NOT NULL,    -- 'audit_logs' | 'login_events' | 'users' | 'reports'
  filters     JSONB NOT NULL,          -- saved query params
  cadence     VARCHAR(20) NOT NULL,    -- 'daily' | 'weekly' | 'monthly'
  recipient_emails TEXT[] NOT NULL,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_reports_due ON scheduled_reports(next_run_at) WHERE enabled = TRUE;
```

**New endpoints.**

```
POST   /admin/scheduled-reports     create
GET    /admin/scheduled-reports     list
PATCH  /admin/scheduled-reports/:id update
DELETE /admin/scheduled-reports/:id delete
```

Plus a new `scheduledReportsJob` cron that runs every 5 minutes and processes due reports.

**Frontend.** New `/admin/scheduled-reports` page with list + create form.

**Effort.** Backend: 4h (table + endpoints + job + email integration). Frontend: 3h.
**Priority.** P2.

---

### 15. Feature flags panel

**Why.** Currently every code path is on for everyone. A feature flag system lets admins gradually roll out changes, kill switches, A/B tests.

**Data sources.** New table or external service (GrowthBook, Flagsmith, LaunchDarkly).

**Schema changes.**

```sql
CREATE TABLE feature_flags (
  key         VARCHAR(100) PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  rollout_percent INTEGER NOT NULL DEFAULT 0,  -- 0..100
  target_roles TEXT[],
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**New endpoints.** CRUD on `/admin/feature-flags`.

**Effort.** Backend: 3h. Frontend: 2h.
**Priority.** P2 (only when there's an actual feature to gate).

---

## Backend support items (chores, not user-visible)

### A. Endpoint to read circuit breaker state
Already implied in #13. Cheap. Worth a separate ticket.

### B. Endpoint to expose `pg.Pool` stats
Already implied in #13. Cheap.

### C. `audit_logs` index on `(action, created_at DESC)`
The PHI access reports query (#9) will scan `audit_logs` with action LIKE filters. Add a covering index when this lands.

### D. Add `notification_outbox` row count metric to `/admin/stats`
So the dashboard can show outbox health without a separate request.

---

## Priority summary

| Priority | Items |
|---|---|
| **P0** | 1 (Outbox monitor) · 2 (Active sessions) · 3 (Job runner health) · 4 (Urgent reports) |
| **P1** | 5 (Provider perf) · 6 (Patient engagement) · 7 (Security ops) · 8 (Linking summary) · 9 (PHI access reports) · 10 (Notification prefs audit) |
| **P2** | 11 (Server search) · 12 (Broadcast) · 13 (System metrics) · 14 (Scheduled reports) · 15 (Feature flags) |

**Recommended order to ship:** 1 → 2 → 3 → 4 (one P0 per day) → 7 → 9 (HIPAA bundle) → rest by demand.
