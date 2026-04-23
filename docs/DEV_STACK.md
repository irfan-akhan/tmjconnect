# Development stack — running TMJConnect in Docker

Everything runs in containers: Postgres, Postgres (test), API, provider portal, admin portal. Edits on your host are picked up instantly via bind-mounted source and HMR.

If you just want the commands, jump to [Quick reference](#quick-reference).

---

## Prerequisites

- Docker Desktop running (`docker ps` should succeed)
- Repo cloned; working directory is the repo root (`tmjconnect/`)
- Ports **3000**, **5173**, **5174**, **5433**, **5434** free on your host
- `node` + `otpauth` installed if you plan to generate TOTP codes for login (they're already dependencies of the API workspace — `npm install` at the repo root covers it)

---

## First-time setup

```bash
# 1. Build the dev images (api + provider + admin share Dockerfile.dev).
#    First run installs node_modules into a container-side volume — takes 2–3 min.
docker-compose -f docker/docker-compose.dev.yml build

# 2. Bring the stack up. The `migrate` service runs once before `api` starts.
docker-compose -f docker/docker-compose.dev.yml up -d

# 3. (Once) Seed the dev database with demo users + data.
docker-compose -f docker/docker-compose.dev.yml exec api npm run db:seed
```

After step 3 you have:

| Service          | URL                             |
|------------------|---------------------------------|
| API              | http://localhost:3000           |
| API health       | http://localhost:3000/health    |
| Provider portal  | http://localhost:5174           |
| Admin portal     | http://localhost:5173           |
| Postgres (dev)   | `localhost:5434` (user/pw `tmjconnect`/`dev_password`) |
| Postgres (test)  | `localhost:5433` (user/pw `tmjconnect`/`test_password`) |

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

```bash
# Start (detached; most common)
docker-compose -f docker/docker-compose.dev.yml up -d

# Stop (preserves volumes — data, node_modules, built shared/dist stay)
docker-compose -f docker/docker-compose.dev.yml down

# Restart one service
docker-compose -f docker/docker-compose.dev.yml restart api

# Tail logs
docker-compose -f docker/docker-compose.dev.yml logs -f api
docker-compose -f docker/docker-compose.dev.yml logs -f provider admin
```

HMR works out of the box:
- Editing `apps/api/src/**` → ts-node-dev restarts the API process
- Editing `apps/provider/src/**` or `apps/admin/src/**` → Vite HMR patches the page
- Editing `packages/shared/src/**` → rebuild shared before other services pick it up:
  ```bash
  docker-compose -f docker/docker-compose.dev.yml exec api npm run build --workspace=packages/shared
  ```
  (Shared is a compiled TS package — neither the API nor the portals watch its source directly.)

---

## Database operations

All run inside the `api` container so they use the container's DATABASE_URL:

```bash
# Apply new migrations
docker-compose -f docker/docker-compose.dev.yml exec api npm run db:migrate

# Re-seed (destructive — wipes dev data, re-inserts demo set)
docker-compose -f docker/docker-compose.dev.yml exec api npm run db:seed

# Open a psql shell
docker-compose -f docker/docker-compose.dev.yml exec postgres psql -U tmjconnect -d tmjconnect
```

Test database is separate (port 5433, db `tmjconnect_test`) and lives in its own volume — running jest doesn't affect dev data.

---

## Running tests

Integration tests hit `postgres_test` directly from the host (jest isn't dockerized):

```bash
# From host
npm run test --workspace=apps/api
```

Or from inside the api container (same result, uses the container's network):

```bash
docker-compose -f docker/docker-compose.dev.yml exec api npm test
```

---

## Reset cheatsheet

```bash
# Stop everything, keep data
docker-compose -f docker/docker-compose.dev.yml down

# Stop + remove dev DB data (fresh schema next up)
docker-compose -f docker/docker-compose.dev.yml down -v

# Nuke the node_modules / shared_dist volumes too (rebuilds on next up)
docker volume rm docker_api_node_modules docker_provider_node_modules \
  docker_admin_node_modules docker_shared_dist 2>/dev/null

# Rebuild dev image from scratch (after dependency changes)
docker-compose -f docker/docker-compose.dev.yml build --no-cache
```

---

## How it works (the 60-second version)

- **`Dockerfile.dev`** (repo root): one image, `npm install --workspaces` runs once at build. Used by api/provider/admin — each service overrides `command:` in compose.
- **Bind mount + named-volume node_modules**: `..:/app` so host edits are live; `<service>_node_modules:/app/node_modules` overlays on top so Linux npm state isn't clobbered by your macOS `node_modules`.
- **`shared_dist` volume**: `packages/shared/dist` is written by the image build, then mounted back in. Prevents the host bind-mount from masking the built output with an empty dir.
- **`migrate` one-shot**: runs `db:migrate`, exits. `api` has `depends_on: { migrate: service_completed_successfully }` so the schema is always current before the app starts.
- **`VITE_PROXY_TARGET=http://api:3000`**: the provider's Vite proxy has to reach the API through the compose network, not `localhost`. The admin portal doesn't proxy — it uses CORS directly to `http://localhost:3000` (port-mapped to the api container).
- **`CHOKIDAR_USEPOLLING=true`**: Docker Desktop doesn't forward fsevents across the bind mount on macOS, so watchers poll (~1–2s slower HMR, acceptable).

---

## Troubleshooting

**`failed to connect to the docker API`**
Docker Desktop isn't running. Open the app.

**API won't start — `MFA_ENCRYPTION_KEY must be exactly 64 hex characters`**
Someone changed the dev secrets. The compose file's `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MFA_ENCRYPTION_KEY` must match whatever encrypted the seeded MFA data. If you rotate keys, re-seed (`npm run db:seed`).

**MFA verify returns `INTERNAL_ERROR` / log says `Unsupported state or unable to authenticate data`**
Same root cause as above — DB contains MFA secrets encrypted with a different key. Re-seed.

**Provider login 401s from the portal, but curl against the API works**
Check the browser devtools network tab. The portal calls `/api/v1/...` which the Vite dev server proxies to `http://api:3000` (compose network). If the proxy is pointing somewhere else (e.g. the old `http://localhost:3000` from host dev), you'll see connection errors. Confirm `VITE_PROXY_TARGET` is set in `docker/docker-compose.dev.yml` and the provider service was restarted after the change.

**HMR not picking up a change**
1. Is the file inside a watched path (`apps/*/src`, `packages/shared/src`)?
2. For `packages/shared` changes: run the `npm run build --workspace=packages/shared` command above — shared is compiled, its source isn't watched.
3. Last resort: `docker-compose -f docker/docker-compose.dev.yml restart <service>`.

**`port is already allocated`**
Another process owns 3000/5173/5174/5433/5434 on your host. Either stop it, or edit the `ports:` mappings in `docker-compose.dev.yml`.

**Stale container after editing `Dockerfile.dev` or `package.json`**
Rebuild: `docker-compose -f docker/docker-compose.dev.yml build <service>` (or `--no-cache` if the npm install needs to re-run).

---

## Quick reference

```bash
# Bring up
docker-compose -f docker/docker-compose.dev.yml up -d

# Tail everything
docker-compose -f docker/docker-compose.dev.yml logs -f

# Bring down
docker-compose -f docker/docker-compose.dev.yml down

# Generate TOTP for admin/provider login (secret is shared across seeded accounts)
node -e "const O=require('otpauth');console.log(new O.TOTP({secret:'JBSWY3DPEHPK3PXP',algorithm:'SHA1',digits:6,period:30}).generate())"
```

For the production stack (nginx + certbot + built SPAs), see [DEPLOYMENT.md](DEPLOYMENT.md).
