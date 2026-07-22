#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
BACKUP_DIR="${OWNEROPS_DATABASE_BACKUP_DIR:-${OWNEROPS_BACKUP_DIR:-backups/database}}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${OWNEROPS_DATABASE_BACKUP_FILE:-$BACKUP_DIR/ownerops-db-$STAMP.dump}"

if [ -z "$DATABASE_URL" ]; then
  echo "OwnerOps database backup failed: DATABASE_URL required." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "OwnerOps database backup failed: pg_dump not found." >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKUP_FILE")"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$BACKUP_FILE" \
  "$DATABASE_URL"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
else
  shasum -a 256 "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
fi

echo "$BACKUP_FILE"
