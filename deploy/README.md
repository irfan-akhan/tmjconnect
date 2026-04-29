# TMJConnect — Deployment Configuration

Three environments. One physical VPS hosts both **test** and **prod** (shared host). Local **dev** runs on your laptop with a local Postgres.

| Environment | Host | DB | API user | API port | Subdomains |
|---|---|---|---|---|---|
| **dev** | your laptop | `tmjconnect` on `localhost:5432` | `tmjconnect` | 3000 | localhost |
| **test** | shared VPS | `tmjconnect_test` on `localhost:5432` | `tmjconnect_api_test` | 3001 | `*.test.tmjconnect.com` |
| **prod** | shared VPS | `tmjconnect` on `localhost:5432` | `tmjconnect_api` | 3000 | `*.tmjconnect.com` |

Test and prod share the same Postgres instance but have **separate roles + databases**. Compromise of the test process cannot read prod data.

---

## File layout

```
deploy/
├── README.md                              ← you are here
├── nginx/
│   ├── common-tls.conf                    → /etc/nginx/snippets/tmjconnect-common-tls.conf
│   ├── prod.conf                          → /etc/nginx/sites-available/tmjconnect-prod
│   └── test.conf                          → /etc/nginx/sites-available/tmjconnect-test
└── systemd/
    ├── tmjconnect-api-prod.service        → /etc/systemd/system/tmjconnect-api-prod.service
    └── tmjconnect-api-test.service        → /etc/systemd/system/tmjconnect-api-test.service

apps/api/
├── .env.development.example               → copy to .env.development (gitignored, local only)
├── .env.test.example                      → fill values, ship to /etc/tmjconnect/api-test.env
└── .env.production.example                → fill values, ship to /etc/tmjconnect/api-prod.env
```

The `.env.*.example` files are committed templates with `CHANGE_ME` placeholders. Real values are gitignored.

---

## How env files load

[apps/api/src/config/env.ts](../apps/api/src/config/env.ts) loads in this order:

1. **VPS:** systemd injects vars from `EnvironmentFile=` before node starts. dotenv finds nothing to load and no-ops.
2. **Local dev:** dotenv loads `.env.${NODE_ENV}` (e.g. `.env.development`), then `.env` as a fallback for any unset keys. First write wins.
3. **Tests (`NODE_ENV=test`):** dotenv is skipped entirely; tests set every var explicitly.

So locally, `npm run dev:api` (which runs `NODE_ENV=development`) reads `apps/api/.env.development`. If you want to mirror prod locally (e.g. to repro a bug), set `NODE_ENV=production` and create `apps/api/.env.production`.

---

## NODE_ENV vs APP_ENV

`NODE_ENV` controls Node-runtime behavior (`npm install --omit=dev`, framework optimizations). Both test and prod set `NODE_ENV=production` so test behaves like prod under load.

`APP_ENV` is the *deployment label* — it's what shows up in Sentry tags and structured logs so you can tell test errors from prod errors at a glance. Values: `development | test | production`.

If you ever see `APP_ENV=production` in a Sentry event coming from the test VPS, something is misconfigured.

---

## First-time host bootstrap (shared VPS)

Run once on a fresh Ubuntu 22.04 box. Replace `<…>` placeholders.

```bash
ssh admin@vps

# ─── System packages ───────────────────────────────────────────────────────
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw nginx postgresql-16 git build-essential certbot python3-certbot-nginx gnupg

# Node 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Firewall
sudo ufw allow 22/tcp 80/tcp 443/tcp
sudo ufw enable

# ─── Postgres roles + databases ────────────────────────────────────────────
sudo -u postgres psql <<SQL
CREATE ROLE tmjconnect_api      WITH LOGIN PASSWORD '<prod-pw>';
CREATE ROLE tmjconnect_api_test WITH LOGIN PASSWORD '<test-pw>';
CREATE DATABASE tmjconnect      OWNER tmjconnect_api;
CREATE DATABASE tmjconnect_test OWNER tmjconnect_api_test;
SQL
# Pin Postgres to localhost only:
sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost'/" /etc/postgresql/16/main/postgresql.conf
sudo systemctl restart postgresql

# ─── Service users (separate per env so test cannot touch prod files) ──────
sudo useradd --system --home /opt/tmjconnect-prod --shell /bin/false tmjconnect-prod
sudo useradd --system --home /opt/tmjconnect-test --shell /bin/false tmjconnect-test

# ─── Directories ───────────────────────────────────────────────────────────
sudo mkdir -p /opt/tmjconnect-prod /opt/tmjconnect-test
sudo mkdir -p /var/lib/tmjconnect-prod/uploads /var/lib/tmjconnect-test/uploads
sudo mkdir -p /etc/tmjconnect
sudo chown -R tmjconnect-prod:tmjconnect-prod /opt/tmjconnect-prod /var/lib/tmjconnect-prod
sudo chown -R tmjconnect-test:tmjconnect-test /opt/tmjconnect-test /var/lib/tmjconnect-test
sudo chmod 750 /etc/tmjconnect

# ─── Repo clones (one per env so deploys don't collide) ────────────────────
sudo -u tmjconnect-prod git clone <repo-url> /opt/tmjconnect-prod
sudo -u tmjconnect-test git clone <repo-url> /opt/tmjconnect-test

# ─── Env files ─────────────────────────────────────────────────────────────
sudo cp /opt/tmjconnect-prod/apps/api/.env.production.example /etc/tmjconnect/api-prod.env
sudo cp /opt/tmjconnect-test/apps/api/.env.test.example       /etc/tmjconnect/api-test.env
sudo vim /etc/tmjconnect/api-prod.env   # fill every CHANGE_ME
sudo vim /etc/tmjconnect/api-test.env   # fill every CHANGE_ME
sudo chown root:tmjconnect-prod /etc/tmjconnect/api-prod.env
sudo chown root:tmjconnect-test /etc/tmjconnect/api-test.env
sudo chmod 640 /etc/tmjconnect/api-prod.env /etc/tmjconnect/api-test.env

# ─── systemd units ─────────────────────────────────────────────────────────
sudo cp /opt/tmjconnect-prod/deploy/systemd/tmjconnect-api-prod.service /etc/systemd/system/
sudo cp /opt/tmjconnect-prod/deploy/systemd/tmjconnect-api-test.service /etc/systemd/system/
sudo systemctl daemon-reload

# ─── nginx ─────────────────────────────────────────────────────────────────
sudo cp /opt/tmjconnect-prod/deploy/nginx/common-tls.conf /etc/nginx/snippets/tmjconnect-common-tls.conf
sudo cp /opt/tmjconnect-prod/deploy/nginx/prod.conf /etc/nginx/sites-available/tmjconnect-prod
sudo cp /opt/tmjconnect-prod/deploy/nginx/test.conf /etc/nginx/sites-available/tmjconnect-test
sudo ln -s ../sites-available/tmjconnect-prod /etc/nginx/sites-enabled/
sudo ln -s ../sites-available/tmjconnect-test /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# ─── First build + start (per env) ─────────────────────────────────────────
for env in prod test; do
  cd /opt/tmjconnect-$env
  sudo -u tmjconnect-$env npm ci
  sudo -u tmjconnect-$env npm run build --workspace=packages/shared
  sudo -u tmjconnect-$env npm run build --workspace=apps/api
  sudo -u tmjconnect-$env npm run build --workspace=apps/provider
  sudo -u tmjconnect-$env npm run build --workspace=apps/admin
  sudo -u tmjconnect-$env bash -c "set -a; source /etc/tmjconnect/api-$env.env; set +a; \
    npm run db:migrate --workspace=apps/api"
done

# Seed test DB only (NOT prod)
sudo -u tmjconnect-test bash -c 'set -a; source /etc/tmjconnect/api-test.env; set +a; \
  npm run db:seed --workspace=apps/api'

sudo systemctl enable --now tmjconnect-api-prod
sudo systemctl enable --now tmjconnect-api-test

# ─── TLS certs (after DNS A records resolve to the VPS) ────────────────────
sudo certbot --nginx \
  -d api.tmjconnect.com -d provider.tmjconnect.com -d admin.tmjconnect.com \
  -d api.test.tmjconnect.com -d provider.test.tmjconnect.com -d admin.test.tmjconnect.com \
  --email ops@tmjconnect.com --agree-tos --no-eff-email

# ─── Smoke ─────────────────────────────────────────────────────────────────
curl -fsS https://api.tmjconnect.com/health
curl -fsS https://api.test.tmjconnect.com/health
```

---

## DNS records

```
A   tmjconnect.com               → <VPS-ip>
A   api.tmjconnect.com           → <VPS-ip>
A   provider.tmjconnect.com      → <VPS-ip>
A   admin.tmjconnect.com         → <VPS-ip>
A   test.tmjconnect.com          → <VPS-ip>
A   api.test.tmjconnect.com      → <VPS-ip>
A   provider.test.tmjconnect.com → <VPS-ip>
A   admin.test.tmjconnect.com    → <VPS-ip>
```

---

## Day-2 ops cheat sheet

```bash
# Logs
sudo journalctl -u tmjconnect-api-prod -f
sudo journalctl -u tmjconnect-api-test -f

# Restart after env change
sudo systemctl restart tmjconnect-api-prod
sudo systemctl restart tmjconnect-api-test

# Status
sudo systemctl status tmjconnect-api-prod tmjconnect-api-test

# Re-seed test DB (destructive — wipes test data)
sudo -u tmjconnect-test bash -c 'set -a; source /etc/tmjconnect/api-test.env; set +a; \
  npm run db:seed --workspace=apps/api'

# Rotate a prod secret
sudo vim /etc/tmjconnect/api-prod.env
sudo systemctl restart tmjconnect-api-prod
```

---

## Backups

Backups run **only on prod**. The test DB is regenerated from the seed script on demand.

See [scripts/backup.sh](../scripts/backup.sh) and [scripts/restore-drill.sh](../scripts/restore-drill.sh). Install the cron entry against `DB_NAME=tmjconnect` and the `tmjconnect_api` role.

---

## See also

- [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) — deeper architecture rationale
- [docs/RUNBOOK.md](../docs/RUNBOOK.md) — incident response and credential rotation
- [docs/GO_LIVE_CHECKLIST.md](../docs/GO_LIVE_CHECKLIST.md) — pre-launch verification
