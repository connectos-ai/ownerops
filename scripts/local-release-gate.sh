#!/usr/bin/env bash
set -euo pipefail

echo "OwnerOps local release gate"
echo "This does not create, push, or publish a GitHub repository."
echo

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "OwnerOps local release gate failed: working tree has unstaged or staged changes." >&2
  git status --short >&2
  exit 1
fi

echo "Checking current branch..."
BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  echo "OwnerOps local release gate failed: expected branch main, got $BRANCH." >&2
  exit 1
fi

echo "Checking remotes..."
if [ -n "$(git remote)" ]; then
  echo "OwnerOps local release gate failed: remotes are configured. Inspect before public release." >&2
  git remote -v >&2
  exit 1
fi

echo "Checking author and committer metadata..."
git log --all --format='%an <%ae>%n%cn <%ce>' | sort -u

echo
echo "Installing dependencies from lockfile..."
npm ci

echo
echo "Running local CI..."
npm run ci

echo
echo "Running whitespace check..."
git diff --check

echo
echo "Running public release audit..."
bash scripts/public-release-audit.sh .

echo
echo "OwnerOps local release gate: PASS"
echo "Remaining required external gates: authenticated GitHub repository inspection/creation, first push, GitHub-hosted CI evidence, and final public-release security audit PASS."
