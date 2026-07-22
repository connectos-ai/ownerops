# Release Evidence Index

Date: 2026-07-22

Status: LOCAL RELEASE EVIDENCE COMPLETE; GITHUB EVIDENCE PENDING

This index points maintainers to the evidence gathered for the public OwnerOps release candidate. It does not mark the release complete. The final gate remains closed until authenticated GitHub repository inspection/creation, GitHub-hosted CI, and the final public-release security audit pass.

## Current Candidate

- Branch: `main`
- Current release-prep status: `docs/security/public-release-security-audit.md` remains `FAIL`
- Target repository: `https://github.com/ownerops-ai/ownerops`
- Target description: `Open-source owner-operator triage Slack-native task system.`

## Product Evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| Standalone task manager works without Slack, email, AI, DoBoth, or ConnectOS | PASS locally | `docs/product-verification.md`, `docs/browser-accessibility-verification.md`, `tests/api-vertical-slice.test.js`, `tests/standalone-task-manager.test.js`, `tests/core-workspace.test.js` |
| Slack Free native templates usable manually | PASS locally | `docs/slack-capability-matrix.md`, `docs/slack-native-starter-guide.md`, `templates/slack-free/` |
| Slack paid templates documented accurately | PASS locally | `docs/slack-capability-matrix.md`, `docs/slack-paid-enhancements.md`, `templates/slack-paid/` |
| Enhanced Slack app mode optional | PASS locally | `docs/slack-enhanced-app.md`, `docs/architecture.md`, tests under `tests/slack-signing-interactions.test.js` |
| Email triage through mock/configured provider boundary | PASS locally | `docs/product-verification.md`, `docs/email-triage.md`, `packages/triage/src/index.js`, `tests/api-vertical-slice.test.js` |
| Daily and weekly briefs from task data | PASS locally | `docs/product-verification.md`, `docs/daily-brief.md`, `docs/weekly-review.md`, `tests/core-workspace.test.js` |
| DoBoth and ConnectOS optional only | PASS locally | `README.md`, `docs/architecture.md`, `docs/api.md` |

## Security And Privacy Evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| Working tree scan | PASS locally | `npm run check`, `bash scripts/public-release-audit.sh .`, private release audit wrapper |
| Git history scan | PASS locally | `docs/security/git-history-privacy-audit.md` |
| Author/committer metadata reviewed | PASS locally | `docs/security/git-history-privacy-audit.md` |
| No private remotes | PASS locally | `docs/security/git-history-privacy-audit.md`, `docs/github-launch-runbook.md` |
| No `.env`, backups, logs, runtime data | PASS locally | `scripts/public-release-audit.sh`, `.gitignore`, local audit results |
| No real personal, client, Slack, Gmail, or machine details | PASS locally | `docs/security/git-history-privacy-audit.md`, public/private audit scans |
| No secret-shaped values | PASS locally | `docs/security/git-history-privacy-audit.md`, `scripts/public-release-audit.sh` |
| HTTP API auth policy reviewed | PASS locally | `docs/security/auth-policy.md`, `tests/api-auth.test.js` |
| Dependency audit reviewed | PASS locally | `npm audit --audit-level=high`, `npm run ci` |
| Database backup/restore procedure reviewed | PASS locally | `docs/storage-and-migrations.md`, database backup/restore tests |

## Quality Evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| CI workflow configured locally | PASS locally | `.github/workflows/ci.yml`, `docs/ci-and-release-gates.md` |
| Clean checkout install | PASS locally | `docs/security/git-history-privacy-audit.md` |
| Tests pass | PASS locally | `npm test` |
| No separate build step required | PASS locally | Dependency-free web app documented in `docs/web-app.md` |
| Local CI passes | PASS locally | `npm run ci` |
| Browser/accessibility verification | PASS locally | `docs/browser-accessibility-verification.md` |
| README quickstart | PASS locally | Clean-checkout quickstart evidence in `docs/security/git-history-privacy-audit.md` |
| Community health files | PASS locally | `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md` |

## GitHub Evidence Still Required

These gates require authenticated GitHub access and must not be marked complete from local-only evidence:

- `ownerops-ai/ownerops` exists or can be created.
- Remote is empty or inspected.
- No force push needed.
- Repository description set.
- Default branch is `main`.
- GitHub-hosted CI passes.
- Final public-release security audit changes to `PASS`.

Use `docs/github-launch-runbook.md` for the exact sequence.

## Required Final Sequence

1. Run all local pre-publish checks in `docs/github-launch-runbook.md`.
2. Inspect or create the GitHub repository with authenticated owner/org permissions.
3. Push `main` without force.
4. Wait for GitHub Actions.
5. Record the hosted CI run URL and outcome.
6. Configure or record branch protection recommendations.
7. Run one final privacy/security scan.
8. Update `docs/security/public-release-security-audit.md` to `PASS` only if all critical and high-risk findings are resolved.
