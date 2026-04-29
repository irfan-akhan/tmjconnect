#!/bin/bash
#
# backup.sh — Encrypted PostgreSQL backup for the pilot VPS.
#
# Runs a single-pipeline pg_dump | gzip | gpg (AES-256) so plaintext PHI
# never touches disk. Output is a single .sql.gz.gpg file.
#
# Install:
#   scp scripts/backup.sh user@vps:/opt/tmjconnect/backup.sh
#   ssh user@vps
#   chmod +x /opt/tmjconnect/backup.sh
#   echo "STRONG_RANDOM_PASSPHRASE" > /opt/tmjconnect/.backup_passphrase
#   chmod 600 /opt/tmjconnect/.backup_passphrase
#   crontab -e   # add: 0 2 * * * /opt/tmjconnect/backup.sh >> /var/log/tmjconnect-backup.log 2>&1
#
# Passphrase handling: store a copy in your password manager — restore is
# impossible without it.
#
# Retention: 30 days locally. Longer retention requires off-VPS sync (s3,
# rsync to a second host, etc.) — this script does not do that.
#
# Requires: pg_dump, gzip, gpg installed on the host. Connection to Postgres
# is driven by standard libpq env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD,
# PGDATABASE) or the overrides below.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/tmjconnect/backups}"
PASSPHRASE_FILE="${PASSPHRASE_FILE:-/opt/tmjconnect/.backup_passphrase}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
DB_USER="${DB_USER:-tmjconnect_api}"
DB_NAME="${DB_NAME:-tmjconnect}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/tmjconnect_${TIMESTAMP}.sql.gz.gpg"

if [ ! -f "${PASSPHRASE_FILE}" ]; then
  echo "[$(date -Iseconds)] ERROR: Passphrase file not found at ${PASSPHRASE_FILE}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

# Single pipeline: pg_dump | gzip | gpg → encrypted file on disk.
# Plaintext never touches disk; a crash mid-pipeline leaves a partial
# encrypted file, which the next run supersedes.
pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${DB_USER}" "${DB_NAME}" \
  | gzip \
  | gpg --batch --yes --symmetric --cipher-algo AES256 \
        --passphrase-file "${PASSPHRASE_FILE}" \
  > "${DUMP_FILE}"

chmod 600 "${DUMP_FILE}"

# Size sanity check — a 0-byte backup indicates pg_dump failed silently.
SIZE=$(wc -c < "${DUMP_FILE}")
if [ "${SIZE}" -lt 1024 ]; then
  echo "[$(date -Iseconds)] ERROR: Backup file too small (${SIZE} bytes) — pg_dump likely failed" >&2
  rm -f "${DUMP_FILE}"
  exit 1
fi

# Prune old backups. Keeping a 30-day window balances disk usage against
# catching corruption that went unnoticed for a week or two.
find "${BACKUP_DIR}" -name "tmjconnect_*.sql.gz.gpg" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] Backup completed: ${DUMP_FILE} ($(du -h "${DUMP_FILE}" | cut -f1))"
