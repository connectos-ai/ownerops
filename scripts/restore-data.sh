#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/restore-data.sh <backup-json-file>" >&2
  exit 1
fi

BACKUP_FILE="$1"
DATA_FILE="${OWNEROPS_DATA_FILE:-data/ownerops.json}"
RESTORE_SAFETY_DIR="${OWNEROPS_RESTORE_SAFETY_DIR:-backups/pre-restore}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "OwnerOps restore failed: backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$BACKUP_FILE"
mkdir -p "$(dirname "$DATA_FILE")"

if [ -f "$DATA_FILE" ]; then
  mkdir -p "$RESTORE_SAFETY_DIR"
  cp "$DATA_FILE" "$RESTORE_SAFETY_DIR/ownerops-before-restore-$STAMP.json"
fi

cp "$BACKUP_FILE" "$DATA_FILE"
echo "$DATA_FILE"
