# GitHub Launch Runbook

Date: 2026-07-22

Status: READY FOR AUTHENTICATED GITHUB EXECUTION

This runbook prepares the public GitHub launch path for OwnerOps. Do not create, push, or publish the repository until every local security, privacy, product, and quality gate passes.

Target repository:

```text
https://github.com/ownerops-ai/ownerops
```

Repository description:

```text
Open-source owner-operator triage Slack-native task system.
```

## Current Local State

- Local branch: `main`.
- Local repository has no configured remote.
- GitHub CLI `gh` is installed in the local verification environment as of 2026-07-22.
- `gh auth status` reports no logged-in GitHub hosts.
- Unauthenticated `git ls-remote https://github.com/ownerops-ai/ownerops.git` could not inspect the repository.
- Treat the target repository as "not authenticated-inspected" until a GitHub account with `ownerops-ai` permissions verifies whether the repository exists, is private, or can be created.

## Source Documents

- https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches

## Pre-Publish Gate

Before creating or pushing the repository, run:

```bash
npm run release:local-gate
```

The command above runs the local gate and refuses to pass with a dirty working tree, a non-`main` branch, or configured remotes.

Equivalent manual commands:

```bash
npm ci
npm run ci
bash scripts/public-release-audit.sh .
git diff --check
git status --short
git log --all --format='%H%x09%an%x09%ae%x09%cn%x09%ce' | sort -u
git remote -v
```

Expected local state:

- Working tree clean.
- Tests and local CI pass.
- Public release audit passes.
- No private remotes.
- Author and committer metadata reviewed.
- `docs/security/public-release-security-audit.md` still says `FAIL` until GitHub-hosted CI evidence exists.

## Create Empty GitHub Repository

If using the GitHub web UI:

1. Owner: `ownerops-ai`.
2. Repository name: `ownerops`.
3. Visibility: Public.
4. Description: `Open-source owner-operator triage Slack-native task system.`
5. Do not initialize with README.
6. Do not initialize with `.gitignore`.
7. Do not initialize with license.
8. Create repository.

GitHub's repository creation docs warn not to pre-populate README, `.gitignore`, or license when importing an existing repository because it can create conflicts.

If using GitHub CLI from an authenticated environment:

```bash
gh auth status
```

If not authenticated, run:

```bash
gh auth login
```

Then create the repository only after local gates pass and the target repository is confirmed absent or empty:

```bash
gh repo create ownerops-ai/ownerops \
  --public \
  --description "Open-source owner-operator triage Slack-native task system." \
  --source . \
  --remote origin \
  --push
```

Use the command above only after all local gates pass and the target repository has been confirmed absent or empty.

## If Repository Already Exists

Do not push until it is inspected.

Inspect:

```bash
gh repo view ownerops-ai/ownerops --json nameWithOwner,visibility,description,defaultBranchRef,isEmpty,pushedAt,url
git ls-remote https://github.com/ownerops-ai/ownerops.git
```

Proceed only if:

- The repository is the intended OwnerOps repository.
- It is empty or contains no legitimate history that would be overwritten.
- No force push is needed.
- The default branch can remain `main`.

If any existing history is present, stop and decide whether to merge, replace with documented owner approval, or use a different repository.

## First Push

If the repository is empty and local gates pass:

```bash
git remote add origin https://github.com/ownerops-ai/ownerops.git
git push -u origin main
```

Never use force push for first publication.

## GitHub-Hosted CI Evidence

After first push:

```bash
gh run list --repo ownerops-ai/ownerops --branch main --limit 5
gh run view --repo ownerops-ai/ownerops --log
```

Required evidence:

- GitHub Actions `Quality Gate` job passes.
- `npm ci` passes.
- `npm run check` passes.
- `npm test` passes.
- `npm audit --audit-level=high` passes.

Record the successful run URL in the final public-release security audit before changing status to `PASS`.

## Branch Protection Recommendation

Create a branch protection rule for `main` after the first successful push and CI run.

Recommended settings:

- Create or verify generic GitHub team `ownerops-ai/maintainers` before requiring CODEOWNERS reviews.

- Require a pull request before merging.
- Require status checks before merging.
- Require the `Quality Gate` status check.
- Require branches to be up to date before merging when appropriate for the team.
- Require conversation resolution before merging.
- Do not allow force pushes.
- Do not allow deletions.
- Consider requiring signed commits if maintainers can support it consistently.
- Consider applying restrictions to admins after the maintainer workflow is confirmed.

GitHub protected-branch documentation lists required pull request reviews, status checks, conversation resolution, signed commits, linear history, and restrictions on force pushes and deletions as available branch protection controls.

## Final Public Release Audit

Only after GitHub-hosted CI passes and branch protection recommendations are recorded:

1. Update `docs/security/public-release-security-audit.md`.
2. Record commit inspected.
3. Record tools used.
4. Record search terms/categories used.
5. Record areas scanned.
6. Record findings and remediation.
7. Record remaining accepted risks.
8. Change status to `PASS` only if zero critical or high-risk findings remain.
