#!/bin/bash
#
# restore-drill.sh — Monthly backup restore verification.
#
# Decrypts the most recent backup, restores into a temporary database
# `tmjconnect_drill`, compares row counts against the live DB for critical
# tables, then drops the drill DB. Run the first Monday of every month and
# log results in docs/RUNBOOK.md § 2.3.
#
# Usage:
#   ssh user@vps
#   /opt/tmjconnect/restore-drill.sh
#   # copy the output's summary line into RUNBOOK.md drill log
#
# Exit codes:
#   0 — drill succeeded; row counts match within tolerance
#   1 — configuration error (missing file, no backups)
#   2 — restore failed (bad pipeline, corrupt backup)
#   3 — row count mismatch (PHI-critical tables differ materially from live)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/tmjconnect/backups}"
PASSPHRASE_FILE="${PASSPHRASE_FILE:-/opt/tmjconnect/.backup_passphrase}"
CONTAINER="${CONTAINER:-tmjconnect-postgres}"
DB_ADMIN="${DB_ADMIN:-postgres}"
LIVE_DB="${LIVE_DB:-tmjconnect}"
DRILL_DB="${DRILL_DB:-tmjconnect_drill}"
# Tolerance: counts can differ by this many rows between the backup (02:00
# UTC snapshot) and live (now) — accommodates legitimate writes during the
# gap. Bump if your write volume grows.
TOLERANCE="${TOLERANCE:-100}"

CRITICAL_TABLES=(users audit_logs symptom_logs reports patient_provider_links)

# ─── Preflight ────────────────────────────────────────────────────────────────
if [ ! -f "${PASSPHRASE_FILE}" ]; then
  echo "ERROR: Passphrase file not found at ${PASSPHRASE_FILE}" >&2
  exit 1
fi

LATEST=$(find "${BACKUP_DIR}" -name "tmjconnect_*.sql.gz.gpg" -type f -print0 \
  | xargs -0 ls -t 2>/dev/null | head -n1 || true)
if [ -z "${LATEST}" ]; then
  echo "ERROR: No backups found in ${BACKUP_DIR}" >&2
  exit 1
fi

echo "[$(date -Iseconds)] Starting restore drill"
echo "  Backup file: ${LATEST}"
echo "  Backup age:  $(( ($(date +%s) - $(stat -c %Y "${LATEST}")) / 3600 )) hours"

# ─── Restore into drill DB ────────────────────────────────────────────────────
TMP_SQL=$(mktemp -t tmjconnect-drill.XXXXXX.sql)
trap 'rm -f "${TMP_SQL}"' EXIT

gpg --batch --decrypt --passphrase-file "${PASSPHRASE_FILE}" "${LATEST}" 2>/dev/null \
  | gunzip > "${TMP_SQL}" || {
    echo "ERROR: Decrypt or decompress failed — backup may be corrupt" >&2
    exit 2
  }

# Start fresh drill DB each run.
docker exec "${CONTAINER}" psql -U "${DB_ADMIN}" -c "DROP DATABASE IF EXISTS ${DRILL_DB};" >/dev/null
docker exec "${CONTAINER}" psql -U "${DB_ADMIN}" -c "CREATE DATABASE ${DRILL_DB};" >/dev/null

# Pipe the SQL dump into psql. Errors here almost always indicate backup
# corruption or a schema incompatibility (e.g. restoring an old dump after
# a migration).
if ! docker exec -i "${CONTAINER}" psql -U "${DB_ADMIN}" -d "${DRILL_DB}" \
      --set ON_ERROR_STOP=on < "${TMP_SQL}" >/dev/null 2>&1; then
  echo "ERROR: Restore failed — check pg_dump compatibility with current Postgres version" >&2
  docker exec "${CONTAINER}" psql -U "${DB_ADMIN}" -c "DROP DATABASE IF EXISTS ${DRILL_DB};" >/dev/null
  exit 2
fi

# ─── Compare critical table row counts ────────────────────────────────────────
MISMATCH=0
SUMMARY=""
for table in "${CRITICAL_TABLES[@]}"; do
  LIVE_COUNT=$(docker exec "${CONTAINER}" psql -U "${DB_ADMIN}" -d "${LIVE_DB}" \
    -tAc "SELECT COUNT(*) FROM ${table};")
  DRILL_COUNT=$(docker exec "${CONTAINER}" psql -U "${DB_ADMIN}" -d "${DRILL_DB}" \
    -tAc "SELECT COUNT(*) FROM ${table};")

  DIFF=$(( LIVE_COUNT - DRILL_COUNT ))
  DIFF_ABS=${DIFF#-}

  if [ "${DIFF_ABS}" -gt "${TOLERANCE}" ]; then
    echo "  ✗ ${table}: live=${LIVE_COUNT} drill=${DRILL_COUNT} diff=${DIFF} (exceeds tolerance=${TOLERANCE})"
    MISMATCH=1
  else
    echo "  ✓ ${table}: live=${LIVE_COUNT} drill=${DRILL_COUNT} diff=${DIFF}"
  fi
  SUMMARY="${SUMMARY}${table}=${DRILL_COUNT}/${LIVE_COUNT} "
done

# ─── Teardown ─────────────────────────────────────────────────────────────────
docker exec "${CONTAINER}" psql -U "${DB_ADMIN}" -c "DROP DATABASE ${DRILL_DB};" >/dev/null

# ─── Result ───────────────────────────────────────────────────────────────────
if [ "${MISMATCH}" -ne 0 ]; then
  echo "[$(date -Iseconds)] DRILL FAILED — row counts outside tolerance" >&2
  echo "SUMMARY: ${SUMMARY}"
  exit 3
fi

echo "[$(date -Iseconds)] Drill passed"
echo "SUMMARY: ${SUMMARY}"
echo ""
echo "Copy this line to docs/RUNBOOK.md § 2.3:"
echo "| $(date -I) | $(basename "${LATEST}") | YES | (measure manually) | (your name) |"
