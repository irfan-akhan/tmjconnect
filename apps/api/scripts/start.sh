#!/bin/sh
# Production entrypoint: apply pending migrations, then start the API.
# Idempotent — drizzle skips already-applied migrations.
# On free-tier hosts without a shell (Render free), this is the only way
# to run migrations. Failure here stops the server from starting, which
# is the correct behavior — serving against a stale schema would corrupt data.
set -e

cd /app/apps/api

echo "[start.sh] Running database migrations..."
node dist-scripts/migrate.js

echo "[start.sh] Starting API server..."
exec node dist/index.js
