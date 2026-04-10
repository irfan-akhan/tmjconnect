# API Changelog

All notable changes to the TMJConnect API are documented here.

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
