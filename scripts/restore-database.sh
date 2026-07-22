#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/restore-database.sh <backup-dump-file>" >&2
  exit 1
fi

BACKUP_FILE="$1"
RESTORE_DATABASE_URL="${OWNEROPS_RESTORE_DATABASE_URL:-${DATABASE_URL:-}}"
CONFIRMATION="${OWNEROPS_RESTORE_CONFIRM:-}"

if [ -z "$RESTORE_DATABASE_URL" ]; then
  echo "OwnerOps database restore failed: OWNEROPS_RESTORE_DATABASE_URL or DATABASE_URL required." >&2
  exit 1
fi

if [ "$CONFIRMATION" != "restore-ownerops-database" ]; then
  echo "OwnerOps database restore refused: set OWNEROPS_RESTORE_CONFIRM=restore-ownerops-database to confirm destructive restore." >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "OwnerOps database restore failed: backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "OwnerOps database restore failed: pg_restore not found." >&2
  exit 1
fi

if [ -f "$BACKUP_FILE.sha256" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "$BACKUP_FILE.sha256"
  else
    shasum -a 256 -c "$BACKUP_FILE.sha256"
  fi
fi

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$RESTORE_DATABASE_URL" \
  "$BACKUP_FILE"

echo "OwnerOps database restored from $BACKUP_FILE"
