# Development stack — running TMJConnect locally

Everything runs natively on your host: Postgres (dev + test), the API, provider portal, and admin portal. No Docker, no containers. Processes watch the repo directly and hot-reload on save.

If you just want the commands, jump to [Quick reference](#quick-reference).

---

## Prerequisites

- **Node 20+** and **npm 10+** (`node -v`, `npm -v`)
- **PostgreSQL 16** running locally and reachable on `localhost:5432`
  - macOS: `brew install postgresql@16 && brew services start postgresql@16`
  - Linux: use your distro's package manager; start the service
- Ports **3000** (API), **5173** (admin), **5174** (provider) free on your host
- Repo cloned; working directory is the repo root (`tmjconnect/`)

---

## First-time setup

```bash
# 1. Install workspace dependencies.
npm install

# 2. Build the shared package so apps can import it.
npm run build --workspace=packages/shared

# 3. Create dev + test databases and a role the API will use.
psql postgres <<'SQL'
CREATE ROLE tmjconnect WITH LOGIN PASSWORD 'dev_password';
CREATE DATABASE tmjconnect      OWNER tmjconnect;
CREATE DATABASE tmjconnect_test OWNER tmjconnect;
SQL

# 4. Copy the env template for the API and fill in the secrets.
cp apps/api/.env.example apps/api/.env
#    At minimum: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, MFA_ENCRYPTION_KEY.
#    DATABASE_URL=postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect

# 5. Apply migrations and seed demo users + data.
npm run db:migrate --workspace=apps/api
npm run db:seed    --workspace=apps/api
```

After step 5 you can bring up each service (in its own terminal):

```bash
npm run dev:api          # http://localhost:3000
npm run dev:provider     # http://localhost:5174
npm run dev:admin        # http://localhost:5173
```

| Service          | URL                             |
|------------------|---------------------------------|
| API              | http://localhost:3000           |
| API health       | http://localhost:3000/health    |
| Provider portal  | http://localhost:5174           |
| Admin portal     | http://localhost:5173           |
| Postgres         | `localhost:5432` (role/pw `tmjconnect`/`dev_password`, DBs `tmjconnect` and `tmjconnect_test`) |

All demo accounts share password `Test@1234!`. Admin + providers require TOTP; the seeded fake secret is `JBSWY3DPEHPK3PXP`. Generate a current code with:

```bash
node -e "const O=require('otpauth');console.log(new O.TOTP({secret:'JBSWY3DPEHPK3PXP',algorithm:'SHA1',digits:6,period:30}).generate())"
```

Seeded accounts:

- Admin: `admin@tmjconnect.dev`
- Providers: `dr.smith@tmjconnect.dev`, `dr.jones@tmjconnect.dev`, `dr.chen@tmjconnect.dev`
- Patients: `alice@tmjconnect.dev`, `bob@tmjconnect.dev`, `carol@tmjconnect.dev`, `dave@tmjconnect.dev`, `eva@tmjconnect.dev`

---

## Daily use

Each app runs in its own terminal. Leave them running; they hot-reload on save.

```bash
npm run dev:api           # ts-node-dev restarts on src changes
npm run dev:provider      # Vite HMR
npm run dev:admin         # Vite HMR
```

Editing `packages/shared/src/**` requires a rebuild before other services pick it up:

```bash
npm run build --workspace=packages/shared
```

(Shared is a compiled TS package — its source isn't watched directly.)

---

## Database operations

All run against your local Postgres using the API's `DATABASE_URL`:

```bash
# Apply new migrations
npm run db:migrate --workspace=apps/api

# Re-seed (destructive — wipes dev data, re-inserts demo set)
npm run db:seed --workspace=apps/api

# Open a psql shell
psql postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect
```

The test database (`tmjconnect_test`) is a separate DB on the same Postgres instance, so jest runs don't affect dev data.

---

## Running tests

Integration tests connect to the `tmjconnect_test` database directly:

```bash
npm run test --workspace=apps/api
```

Make sure migrations have been applied to the test DB at least once:

```bash
DATABASE_URL=postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect_test \
  npm run db:migrate --workspace=apps/api
```

---

## Reset cheatsheet

```bash
# Drop and recreate the dev DB (fresh schema, no seed data)
psql postgres -c "DROP DATABASE tmjconnect;" \
  && psql postgres -c "CREATE DATABASE tmjconnect OWNER tmjconnect;" \
  && npm run db:migrate --workspace=apps/api

# Same for the test DB
psql postgres -c "DROP DATABASE tmjconnect_test;" \
  && psql postgres -c "CREATE DATABASE tmjconnect_test OWNER tmjconnect;"

# Re-seed demo data
npm run db:seed --workspace=apps/api

# Nuke node_modules (after dependency changes)
rm -rf node_modules apps/*/node_modules packages/*/node_modules \
  && npm install
```

---

## How it works (the 60-second version)

- **npm workspaces** at the repo root. `npm install` hoists a single `node_modules` tree.
- **`apps/api`** runs under `ts-node-dev`, which restarts the process on any `src/**` change.
- **`apps/provider` and `apps/admin`** run under Vite dev server — HMR patches the page without a reload.
- **`packages/shared`** is a compiled TS package (dist is committed to `packages/shared/dist` via `tsc`). Other workspaces import the compiled output, so rebuild after editing its source.
- **Provider Vite proxy** forwards `/api/v1/...` to `http://localhost:3000`. The admin portal calls the API via CORS directly.
- **Migrations** run through `apps/api/scripts/migrate.ts` against the `DATABASE_URL` in `apps/api/.env`.

---

## Troubleshooting

**API won't start — `MFA_ENCRYPTION_KEY must be exactly 64 hex characters`**
Your `apps/api/.env` is missing a secret. The `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MFA_ENCRYPTION_KEY` values must match whatever encrypted the seeded MFA data. If you rotate keys, re-seed (`npm run db:seed --workspace=apps/api`).

**MFA verify returns `INTERNAL_ERROR` / log says `Unsupported state or unable to authenticate data`**
Same root cause as above — DB contains MFA secrets encrypted with a different key. Re-seed.

**`ECONNREFUSED` when API starts**
Postgres isn't running on `localhost:5432`. On macOS: `brew services start postgresql@16`. Check `psql postgres` succeeds before going further.

**`role "tmjconnect" does not exist`**
You skipped the `CREATE ROLE` step above. Re-run step 3 of first-time setup.

**Provider login 401s from the portal, but curl against the API works**
Check the browser devtools network tab — the portal calls `/api/v1/...` which the Vite dev server proxies to `http://localhost:3000`. If the API isn't running, or the proxy target in `apps/provider/vite.config.ts` points elsewhere, you'll see connection errors.

**HMR not picking up a change**
1. Is the file inside a watched path (`apps/*/src`, `packages/shared/src`)?
2. For `packages/shared` changes: run `npm run build --workspace=packages/shared` — shared is compiled, its source isn't watched.
3. Last resort: restart the dev process for that app.

**`port is already allocated` / `EADDRINUSE`**
Another process owns 3000/5173/5174 on your host. Either stop it, or edit the port in the offending app's config (`apps/api/src/index.ts` for the API, `vite.config.ts` for the portals).

---

## Quick reference

```bash
# Bring up (in separate terminals)
npm run dev:api
npm run dev:provider
npm run dev:admin

# Migrations / seed
npm run db:migrate --workspace=apps/api
npm run db:seed    --workspace=apps/api

# Psql shell
psql postgresql://tmjconnect:dev_password@localhost:5432/tmjconnect

# Generate TOTP for admin/provider login (secret is shared across seeded accounts)
node -e "const O=require('otpauth');console.log(new O.TOTP({secret:'JBSWY3DPEHPK3PXP',algorithm:'SHA1',digits:6,period:30}).generate())"
```

For the production deployment (nginx + certbot + built SPAs), see [DEPLOYMENT.md](DEPLOYMENT.md).
