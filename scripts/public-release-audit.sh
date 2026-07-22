#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if ! command -v rg >/dev/null 2>&1; then
  echo "public release audit: FAIL"
  echo "ripgrep is required"
  exit 1
fi

find "$ROOT" \
  \( -name '.env' -o -name '.env.*' \) \
  ! -name '.env.example' \
  ! -path '*/.git/*' \
  -print | awk '{ print "private env file: " $0 }' >> "$TMP" || true

LOCAL_PATH_PATTERN="/U""sers/|/h""ome/"
SECRET_PATTERN='xox[baprs]-|ya29\.|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}'

rg -n --hidden \
--glob '!.git/**' \
--glob '!node_modules/**' \
--glob '!package-lock.json' \
--glob '!coverage/**' \
--glob '!scripts/public-release-audit.sh' \
"$LOCAL_PATH_PATTERN" "$ROOT" \
| awk -F: '{ print "blocked local path: " $1 ":" $2 }' >> "$TMP" || true

rg -n -i --hidden \
--glob '!.git/**' \
--glob '!node_modules/**' \
--glob '!package-lock.json' \
--glob '!coverage/**' \
--glob '!scripts/public-release-audit.sh' \
"$SECRET_PATTERN" "$ROOT" \
| awk -F: '{ print "blocked term: " $1 ":" $2 }' >> "$TMP" || true

if [ -n "${OWNEROPS_PRIVATE_DENYLIST:-}" ]; then
  rg -n -i --hidden \
    --glob '!.git/**' \
    --glob '!node_modules/**' \
    --glob '!package-lock.json' \
    --glob '!coverage/**' \
    --glob '!scripts/public-release-audit.sh' \
    "$OWNEROPS_PRIVATE_DENYLIST" "$ROOT" \
    | awk -F: '{ print "private denylist term: " $1 ":" $2 }' >> "$TMP" || true
fi

rg -n -i --hidden \
  --glob '!.git/**' \
  --glob '!node_modules/**' \
  --glob '!package-lock.json' \
  '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' "$ROOT" \
  | awk -F: 'BEGIN{IGNORECASE=1} $0 !~ /@(example\.com|example\.local|example\.org)/ { print "non-placeholder email: " $1 ":" $2 }' >> "$TMP" || true

if [ -s "$TMP" ]; then
  echo "public release audit: FAIL"
  sort -u "$TMP"
  exit 1
fi

echo "public release audit: PASS"
