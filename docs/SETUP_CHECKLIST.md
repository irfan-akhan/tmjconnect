# TMJConnect API — Setup Checklist

Follow these steps in order to get the API running locally.

---

## Prerequisites

- [ ] **Node.js >= 20** installed (`node -v`)
- [ ] **npm >= 10** installed (`npm -v`)
- [ ] **Docker** installed and running (`docker --version`)
- [ ] **Git** — repo cloned at `tmjconnect/`

---

## 1. Start PostgreSQL

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d
```

Verify it's running:
```bash
docker compose -f docker-compose.dev.yml ps
# postgres should show "healthy"
```

Connection details (from docker-compose.dev.yml):
- Host: `localhost`
- Port: `5432`
- Database: `tmjconnect`
- User: `tmjconnect`
- Password: `dev_password`

---

## 2. Enable uuid-ossp Extension

The schema uses `uuid_generate_v4()`. Connect to the database and enable it:

```bash
docker exec -it docker-postgres-1 psql -U tmjconnect -d tmjconnect -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

---

## 3. Install Dependencies

From the repo root:
```bash
npm install
```

This installs all workspaces (`apps/api`, `packages/shared`).

---

## 4. Build Shared Package

The API imports types and schemas from `@tmjconnect/shared`. It must be built before the API can start:

```bash
cd packages/shared
npm run build
cd ../..
```

Or from root:
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
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Generate: same command, different value |
| `MFA_ENCRYPTION_KEY` | Generate: same command (must be exactly 64 hex chars) |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:8081` |

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
cd apps/api
DATABASE_URL="postgresql://tmjconnect:dev_password@127.0.0.1:5434/tmjconnect" npx drizzle-kit push:pg
cd ../..
```

This reads the Drizzle schema files and applies them directly to the database (creates all tables, enums, indexes, and constraints).

---

## 7. Create Upload Directory

If using local storage driver (default):
```bash
mkdir -p apps/api/uploads
```

---

## 8. Start the API

From the repo root:
```bash
npm run dev:api
```

Or from `apps/api/`:
```bash
npm run dev
```

You should see:
```
TMJConnect API started { port: 3000, env: 'development' }
Database connection verified
Scheduled jobs registered (5 jobs)
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
| `Cannot connect to database — shutting down` | Ensure PostgreSQL is running: `docker compose -f docker/docker-compose.dev.yml ps` |
| `relation "users" does not exist` | Run migrations: Step 6 |
| `function uuid_generate_v4() does not exist` | Enable extension: Step 2 |
| `Cannot find module '@tmjconnect/shared'` | Build shared package: Step 4 |
| `EADDRINUSE: port 3000` | Another process is using port 3000. Kill it or change `PORT` in `.env` |
| TypeScript errors in IDE | Run `npm install` from root, then build shared package |

---

## Quick Start (all steps in one go)

```bash
# 1. PostgreSQL
cd docker && docker compose -f docker-compose.dev.yml up -d && cd ..

# 2. uuid extension
docker exec -it docker-postgres-1 psql -U tmjconnect -d tmjconnect -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'

# 3. Dependencies
npm install

# 4. Build shared
npm run build --workspace=packages/shared

# 5. Environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set JWT_SECRET, JWT_REFRESH_SECRET, MFA_ENCRYPTION_KEY, DATABASE_URL

# 6. Migrations
cd apps/api && DATABASE_URL="postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect" npx drizzle-kit push:pg && cd ../..

# 7. Upload dir
mkdir -p apps/api/uploads

# 8. Start
npm run dev:api
```
