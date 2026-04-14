# API Changelog

All notable changes to the TMJConnect API are documented here.

## v1.1.0 — 2026-04-14

Provider portal support: clinical notes, report requests, provider-authored reports, and avatar upload persistence.

### Added — Clinical notes (provider-only, never patient-visible)
- `GET  /providers/patients/:patientId/notes?page=&limit=` — list notes for a patient (provider-scoped)
- `POST /providers/patients/:patientId/notes` — body `{ body, tags[] }`
- `PATCH /providers/notes/:noteId` — partial update `{ body?, tags? }`
- `DELETE /providers/notes/:noteId`

### Added — Report requests (provider → patient nudge)
- `POST /providers/patients/:patientId/report-requests` — body `{ prompt }`; triggers `report_requested` notification
- `GET  /providers/patients/:patientId/report-requests` — list requests for a patient (provider-scoped)
- `GET  /reports/requests?status=&patient_id=` — role-aware; patients see their own pending requests, providers see theirs
- `DELETE /reports/requests/:id` — dismiss (either role within their own scope)

### Added — Provider on-behalf-of reports
- `POST /providers/patients/:patientId/reports` — body `{ urgency, pain_level?, description, photo_url?, period_start?, period_end?, patient_notes?, fulfilling_request_id? }`. If `fulfilling_request_id` is provided, the matching report_request transitions to `fulfilled`. A `provider_message` notification is sent to the patient.

### Added — Dashboard aggregate
- `GET /providers/dashboard/summary` — single-call aggregate of `activePatients`, `unreadReports`, `pendingCodes`, `urgentReports`, plus `recentPatients` and `urgentInbox` arrays. Replaces four client-side fan-out queries.

### Added — HIPAA right-of-access
- `GET /patients/me/export` — authenticated patient pulls a full JSON archive of their records. Synchronous at pilot scale (25–50 users); move to async + signed URL for production. Excludes `clinical_notes` and `report_responses.internal_notes` (provider-private).

### Changed
- `PATCH /providers/me` — `updateProviderProfileSchema` now accepts `avatar_url` (string URL or null).
- `reports.authored_by_user_id` + `reports.authored_by_role` columns added (migration 0007). Patient-submitted reports continue to set `authored_by_role='patient'`.
- `NotificationType` gains `report_requested` (push + email). Non-breaking additive change.

### Migration
- `0007_clinical_notes_report_requests_on_behalf.sql`
  - `CREATE TABLE clinical_notes` (id, patient_id, provider_id, body, tags[], timestamps)
  - `CREATE TYPE report_request_status AS ENUM ('pending','fulfilled','dismissed')`
  - `CREATE TABLE report_requests` (id, provider_id, patient_id, prompt, status, fulfilled_report_id, fulfilled_at, dismissed_at, created_at)
  - `ALTER TABLE reports ADD COLUMN authored_by_user_id, authored_by_role`; backfills `authored_by_user_id=patient_id` for historical rows.

## v1.0.0 — 2026-04-10

Initial API release covering Sprints 1–4.

### Auth (15 endpoints)
- POST /auth/register — patient + provider registration (discriminated union)
- POST /auth/verify-email — 6-digit code, returns tokens or MFA setup
- POST /auth/login — bcrypt, lockout after 5 failures, MFA for providers
- POST /auth/mfa/setup, /mfa/verify-setup, /mfa/verify, /mfa/sms — full TOTP + SMS + backup code flow
- POST /auth/refresh — token rotation with reuse detection
- POST /auth/forgot-password, /auth/reset-password — 1h expiry, invalidates all sessions
- POST /auth/resend-verify-email — rate limited 1 per 2 minutes
- DELETE /auth/logout, /auth/logout-all — session cleanup
- PATCH /auth/change-password — requires current password
- PATCH /auth/fcm-token — Firebase push token

### Patients (7 endpoints)
- GET/PATCH/DELETE /patients/me — profile CRUD + soft delete
- GET/DELETE /patients/me/sessions/:id — session management
- GET/PATCH /patients/me/notification-preferences

### Symptoms (5 endpoints)
- POST /symptoms — upsert (one log per day per patient)
- GET /symptoms — cursor paginated list
- GET /symptoms/calendar — monthly aggregation
- GET/PATCH /symptoms/:id — detail + edit (24h window enforced by DB trigger)

### Exercises (2 endpoints)
- GET /exercises/assignments — patient's active assignments
- POST /exercises/assignments/:id/complete — idempotent daily completion

### Notifications (3 endpoints)
- GET /notifications — cursor paginated with unread_count
- PATCH /notifications/read-all
- PATCH /notifications/:id/read

### Reminders (4 endpoints)
- GET/POST /reminders — list + create
- PATCH/DELETE /reminders/:id

### Providers (12 endpoints)
- GET/PATCH /providers/me — profile with provider_details
- GET /providers/patients — linked patient dashboard (7-day stats)
- GET /providers/patients/:id — patient detail (link verified)
- GET/POST /providers/patients/:id/assignments — view + assign exercises
- PATCH/DELETE /providers/assignments/:id
- GET/POST /providers/exercises — exercise library CRUD
- PATCH/DELETE /providers/exercises/:id

### Reports (6 endpoints)
- POST /reports — patient submission with Idempotency-Key header
- GET /reports/inbox — provider inbox (urgency sort, filters)
- GET /reports/:id — detail (role-aware: patients don't see internal_notes)
- POST /reports/:id/respond — provider response
- PATCH /reports/:id/review — mark reviewed
- PATCH /reports/:id/flag — toggle flag

### Linking (7 endpoints)
- GET /linking/links — active links (both roles)
- DELETE /linking/links/:id — disconnect (either party)
- POST/GET /linking/codes — generate + list codes (provider)
- POST /linking/codes/:id/invite — email invite
- POST /linking/accept — patient accepts code

### Uploads (3 endpoints)
- POST /uploads/video — provider only, 100MB, mp4/mov, magic-byte validated
- POST /uploads/avatar — any user, 5MB, jpg/png
- POST /uploads/report-photo — patient, 10MB, jpg/png

### Security
- JWT access tokens (15min) + refresh token rotation (7 days)
- MFA required for providers (TOTP + SMS fallback + backup codes)
- Rate limiting: 5 tiers (general, auth, mfa, password-reset, email-verify)
- HIPAA audit logging on 22 endpoints
- DOMPurify sanitisation on all free-text fields
- Row-level access control via scopeToUser + verifyProviderLink
- internal_notes never exposed in patient-facing responses
