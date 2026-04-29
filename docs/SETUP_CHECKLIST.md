# TMJConnect API — Setup Checklist

Follow these steps in order to get the API running locally.

---

## Prerequisites

- [ ] **Node.js >= 20** installed (`node -v`)
- [ ] **npm >= 10** installed (`npm -v`)
- [ ] **PostgreSQL 16** installed and running on `localhost:5432` (`psql postgres -c 'SELECT 1'` works)
- [ ] **Git** — repo cloned at `tmjconnect/`

macOS quickstart: `brew install postgresql@16 && brew services start postgresql@16`
Ubuntu quickstart: `sudo apt install postgresql-16 && sudo systemctl start postgresql`

---

## 1. Create the Databases and Role

```bash
psql postgres <<'SQL'
CREATE ROLE tmjconnect WITH LOGIN PASSWORD 'dev_password';
CREATE DATABASE tmjconnect      OWNER tmjconnect;
CREATE DATABASE tmjconnect_test OWNER tmjconnect;
SQL
```

Connection details:
- Host: `localhost`
- Port: `5432`
- Dev database: `tmjconnect`
- Test database: `tmjconnect_test`
- User: `tmjconnect`
- Password: `dev_password`

---

## 2. Enable uuid-ossp Extension

The schema uses `uuid_generate_v4()`. Enable it in both databases:

```bash
psql postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
psql postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect_test \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

---

## 3. Install Dependencies

From the repo root:
```bash
npm install
```

This installs all workspaces (`apps/api`, `apps/provider`, `apps/admin`, `packages/shared`).

---

## 4. Build Shared Package

The API imports types and schemas from `@tmjconnect/shared`. It must be built before the API can start:

```bash
npm run build --workspace=packages/shared
```

---

## 5. Create Environment File

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and set the **required** values:

### Required (server won't start without these)

| Variable | Value for local dev |
|---|---|
| `DATABASE_URL` | `postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect` |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Generate: same command, different value |
| `MFA_ENCRYPTION_KEY` | Generate: `openssl rand -hex 32` (must be exactly 64 hex chars) |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:5174,http://localhost:8081` |

### Optional (stub mode in dev if absent)

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | Emails logged to console if absent |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER` | SMS logged to console if absent |
| `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` | Push notifications are no-ops if absent |
| `SENTRY_DSN` | Errors only logged locally if absent |

### Defaults (usually fine as-is)

| Variable | Default |
|---|---|
| `NODE_ENV` | `development` |
| `PORT` | `3000` |
| `STORAGE_DRIVER` | `local` |
| `UPLOAD_DIR` | `./uploads` |
| `APP_URL` | `http://localhost:8081` |
| `API_URL` | `http://localhost:3000` |
| `LOG_LEVEL` | `info` |

---

## 6. Run Database Migrations

```bash
npm run db:migrate --workspace=apps/api

# Same command, against the test DB
DATABASE_URL=postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect_test \
  npm run db:migrate --workspace=apps/api
```

This applies the hand-written SQL migrations in `apps/api/drizzle/migrations/` (tables, enums, indexes, triggers, check constraints).

---

## 7. Create Upload Directory

If using the local storage driver (default):
```bash
mkdir -p apps/api/uploads
```

---

## 8. Start the API

From the repo root:
```bash
npm run dev:api
```

You should see:
```
TMJConnect API started { port: 3000, env: 'development' }
Database connection verified
Scheduled jobs registered
Swagger UI available at /docs
```

---

## 9. Verify Everything Works

### Health check
```bash
curl http://localhost:3000/health
# {"status":"healthy","timestamp":"...","checks":{"database":"ok","uptime":...}}
```

### Swagger UI
Open in browser: [http://localhost:3000/docs](http://localhost:3000/docs)

### Test patient registration
```bash
curl -X POST http://localhost:3000/api/v1/auth/patient/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!",
    "first_name": "Test",
    "last_name": "Patient"
  }'
# {"message":"Check your email to verify your account."}
```

Check the console logs for the verification code (since Resend is in stub mode):
```
[EmailService stub] Email would be sent { to: 'test@example.com', subject: 'Verify your TMJConnect email address' }
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `FATAL: Environment validation failed` | Check `.env` file — a required variable is missing or malformed |
| `Cannot connect to database — shutting down` | Ensure PostgreSQL is running: `pg_isready` on macOS/Linux, or `brew services list` / `systemctl status postgresql` |
| `role "tmjconnect" does not exist` | Re-run Step 1 |
| `relation "users" does not exist` | Run migrations: Step 6 |
| `function uuid_generate_v4() does not exist` | Enable extension: Step 2 |
| `Cannot find module '@tmjconnect/shared'` | Build shared package: Step 4 |
| `EADDRINUSE: port 3000` | Another process is using port 3000. Kill it or change `PORT` in `.env` |
| TypeScript errors in IDE | Run `npm install` from root, then build shared package |

---

## Quick Start (all steps in one go)

```bash
# 1. Create role + dev/test databases
psql postgres <<'SQL'
CREATE ROLE tmjconnect WITH LOGIN PASSWORD 'dev_password';
CREATE DATABASE tmjconnect      OWNER tmjconnect;
CREATE DATABASE tmjconnect_test OWNER tmjconnect;
SQL

# 2. uuid extension (both DBs)
psql postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
psql postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect_test \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'

# 3. Dependencies
npm install

# 4. Build shared
npm run build --workspace=packages/shared

# 5. Environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set JWT_SECRET, JWT_REFRESH_SECRET, MFA_ENCRYPTION_KEY, DATABASE_URL

# 6. Migrations (dev + test)
npm run db:migrate --workspace=apps/api
DATABASE_URL=postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect_test \
  npm run db:migrate --workspace=apps/api

# 7. Upload dir
mkdir -p apps/api/uploads

# 8. Start
npm run dev:api
```
