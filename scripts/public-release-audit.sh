#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

scan() {
  local flags=()

  if [ "${1:-}" = "--ignore-case" ]; then
    flags=(-i)
    shift
  fi

  local pattern="$1"
  local root="$2"

  if command -v rg >/dev/null 2>&1; then
    rg -n ${flags[@]+"${flags[@]}"} --hidden \
      --glob '!.git/**' \
      --glob '!node_modules/**' \
      --glob '!package-lock.json' \
      --glob '!coverage/**' \
      --glob '!scripts/public-release-audit.sh' \
      "$pattern" "$root"
    return
  fi

  grep -R -n -I -E ${flags[@]+"${flags[@]}"} \
    --exclude='package-lock.json' \
    --exclude='public-release-audit.sh' \
    --exclude-dir='.git' \
    --exclude-dir='node_modules' \
    --exclude-dir='coverage' \
    "$pattern" "$root"
}

find "$ROOT" \
  \( -name '.env' -o -name '.env.*' \) \
  ! -name '.env.example' \
  ! -path '*/.git/*' \
  -print | awk '{ print "private env file: " $0 }' >> "$TMP" || true

LOCAL_PATH_PATTERN="/U""sers/|/h""ome/"
SECRET_PATTERN='xox[baprs]-|ya29\.|BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}'

scan "$LOCAL_PATH_PATTERN" "$ROOT" \
  | awk -F: '{ print "blocked local path: " $1 ":" $2 }' >> "$TMP" || true

scan --ignore-case "$SECRET_PATTERN" "$ROOT" \
  | awk -F: '{ print "blocked term: " $1 ":" $2 }' >> "$TMP" || true

if [ -n "${OWNEROPS_PRIVATE_DENYLIST:-}" ]; then
  scan --ignore-case "$OWNEROPS_PRIVATE_DENYLIST" "$ROOT" \
    | awk -F: '{ print "private denylist term: " $1 ":" $2 }' >> "$TMP" || true
fi

scan --ignore-case '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' "$ROOT" \
  | awk -F: 'BEGIN{IGNORECASE=1} $0 !~ /@(example\.com|example\.local|example\.org)/ { print "non-placeholder email: " $1 ":" $2 }' >> "$TMP" || true

if [ -s "$TMP" ]; then
  echo "public release audit: FAIL"
  sort -u "$TMP"
  exit 1
fi

echo "public release audit: PASS"
