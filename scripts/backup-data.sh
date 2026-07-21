#!/usr/bin/env bash
set -euo pipefail

DATA_FILE="${OWNEROPS_DATA_FILE:-data/ownerops.json}"
BACKUP_DIR="${OWNEROPS_BACKUP_DIR:-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/ownerops-$STAMP.json"

if [ ! -f "$DATA_FILE" ]; then
  echo "OwnerOps backup failed: data file not found: $DATA_FILE" >&2
  exit 1
fi

node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$DATA_FILE"
mkdir -p "$BACKUP_DIR"
cp "$DATA_FILE" "$BACKUP_FILE"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
else
  shasum -a 256 "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
fi

echo "$BACKUP_FILE"
