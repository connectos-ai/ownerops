# Release Evidence Index

Date: 2026-07-29

Status: PUBLIC RELEASE COMPLETE

This index points maintainers to evidence gathered for the public OwnerOps
release.

## Current Candidate

- Branch: `main`.
- Latest public release checkpoint: `79e3fcfcef3c9f900a88eea723bfa1d568794da4`.
- Public repository: `https://github.com/connectos-ai/ownerops`.
- Repository visibility: public.
- Repository description: `Open-source owner-operator triage Slack-native task
  system.`
- Default branch: `main`.
- GitHub-hosted CI:
  `https://github.com/connectos-ai/ownerops/actions/runs/30492679255`.
- Release security audit: `docs/security/public-release-security-audit.md`.

## Product Evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| Standalone task manager works without Slack, email, AI, DoBoth, or ConnectOS | PASS | `docs/product-verification.md`, `docs/browser-accessibility-verification.md`, `tests/api-vertical-slice.test.js`, `tests/standalone-task-manager.test.js`, `tests/core-workspace.test.js` |
| Workspace user lifecycle identity mapping | PASS | `docs/task-system.md`, `docs/api.md`, `tests/workspace-setup.test.js` |
| Task reviewer, approver, related-user filtering | PASS | `docs/task-system.md`, `docs/api.md`, `tests/standalone-task-manager.test.js`, `tests/relational-store.test.js` |
| Slack Free native templates usable manually | PASS | `docs/slack-capability-matrix.md`, `docs/slack-native-starter-guide.md`, `templates/slack-free/` |
| Slack plan-aware docs | PASS | `docs/objective-coverage-audit.md` |
| Public current-state audit | PASS | `docs/current-state-audit.md` |
| Storage, migrations, backup, restore-test coverage | PASS | `docs/storage-and-migrations.md`, `tests/database-backup-scripts.test.js`, `tests/storage-persistence.test.js`, `tests/storage-relational-schema.test.js`, `tests/relational-store.test.js` |

## Security And Privacy Evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| Working tree scan | PASS | `scripts/public-release-audit.sh`, final audit results |
| Structured public-release security audit report | PASS | `docs/security/public-release-security-audit.md` |
| Git history scan | PASS | `docs/security/git-history-privacy-audit.md` |
| Author/committer metadata reviewed | PASS | `docs/security/git-history-privacy-audit.md`, `npm run release:local-gate` |
| No `.env`, backups, logs, runtime data | PASS | `.gitignore`, `scripts/public-release-audit.sh` |
| No real personal, client, Slack, Gmail, or machine details | PASS | `docs/security/git-history-privacy-audit.md`, public/private audit scans |
| No secret-shaped values | PASS | `docs/security/git-history-privacy-audit.md`, `scripts/public-release-audit.sh` |
| HTTP API auth policy reviewed | PASS | `docs/security/auth-policy.md`, `tests/api-auth.test.js` |
| Privacy-conscious log redaction utility tested | PASS | `packages/observability/src/index.js`, `tests/observability-redaction.test.js` |

## Quality Evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| Local CI | PASS | `npm run ci` |
| GitHub-hosted CI | PASS | `https://github.com/connectos-ai/ownerops/actions/runs/30492679255` |
| Public release audit portable in CI | PASS | `scripts/public-release-audit.sh` |
| License, security policy, contribution guide, code of conduct | PASS | `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` |
| GitHub issue and pull request templates | PASS | `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS` |
| Deployment, troubleshooting, roadmap docs | PASS | `docs/deployment.md`, `docs/troubleshooting.md`, `docs/roadmap.md` |
| Dependency update configuration | PASS | `.github/dependabot.yml`, `docs/ci-and-release-gates.md` |

## GitHub Evidence

- GitHub CLI authenticated publication path was available.
- `connectos-ai/ownerops` exists and is public.
- Remote was absent before repository creation.
- `origin` is `https://github.com/connectos-ai/ownerops.git`.
- `main` was pushed without force.
- Default branch is `main`.
- Repository description is set.
- GitHub-hosted CI passed.
- Branch protection is not enabled on `connectos-ai/ownerops`; this matches the
  observed state of sibling repositories `connectos-ai/connectos` and
  `connectos-ai/scheduleos` on 2026-07-29.
- Branch protection recommendations remain documented in
  `docs/github-launch-runbook.md`.
