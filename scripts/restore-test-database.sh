#!/usr/bin/env bash
set -euo pipefail

SOURCE_DATABASE_URL="${DATABASE_URL:-}"
RESTORE_TEST_DATABASE_URL="${OWNEROPS_RESTORE_TEST_DATABASE_URL:-}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ownerops-db-restore-test.XXXXXX")"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [ -z "$SOURCE_DATABASE_URL" ]; then
  echo "OwnerOps database restore-test failed: DATABASE_URL required for source database." >&2
  exit 1
fi

if [ -z "$RESTORE_TEST_DATABASE_URL" ]; then
  echo "OwnerOps database restore-test failed: OWNEROPS_RESTORE_TEST_DATABASE_URL required for isolated restore target." >&2
  exit 1
fi

if [ "$SOURCE_DATABASE_URL" = "$RESTORE_TEST_DATABASE_URL" ]; then
  echo "OwnerOps database restore-test refused: source and restore-test database URLs must differ." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "OwnerOps database restore-test failed: psql not found." >&2
  exit 1
fi

BACKUP_FILE="$(
  OWNEROPS_DATABASE_BACKUP_DIR="$TMP_DIR" \
    "$ROOT_DIR/scripts/backup-database.sh"
)"

OWNEROPS_RESTORE_CONFIRM=restore-ownerops-database \
OWNEROPS_RESTORE_DATABASE_URL="$RESTORE_TEST_DATABASE_URL" \
  "$ROOT_DIR/scripts/restore-database.sh" "$BACKUP_FILE" >/dev/null

psql "$RESTORE_TEST_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -Atc "SELECT to_regclass('public.ownerops_schema_migrations') IS NOT NULL AND to_regclass('public.workspaces') IS NOT NULL AND to_regclass('public.tasks') IS NOT NULL AND to_regclass('public.slack_installations') IS NOT NULL;" \
  | grep -qx 't'

echo "OwnerOps database restore-test passed using isolated restore target."
