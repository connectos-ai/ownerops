# Release Evidence Index

Date: 2026-07-22

Status: LOCAL RELEASE EVIDENCE COMPLETE; GITHUB EVIDENCE PENDING

This index points maintainers to evidence gathered for the public OwnerOps
release candidate. It does not mark release complete. The final gate remains
closed until authenticated GitHub repository inspection or creation,
GitHub-hosted CI, and final public-release security audit pass.

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
| Enhanced Slack app mode optional | PASS locally | `docs/slack-enhanced-app.md`, `docs/architecture.md`, `tests/slack-signing-interactions.test.js` |
| Email triage through mock/configured provider boundary | PASS locally | `docs/product-verification.md`, `docs/email-triage.md`, `packages/triage/src/index.js`, `tests/api-vertical-slice.test.js` |
| Daily and weekly briefs work from task data | PASS locally | `docs/product-verification.md`, `docs/daily-brief.md`, `docs/weekly-review.md`, `tests/core-workspace.test.js` |
| DoBoth and ConnectOS optional adapters only | PASS locally | `README.md`, `docs/architecture.md`, `docs/integration-model.md`, `packages/adapters/src/index.js` |
| Public API/event/integration boundaries documented | PASS locally | `docs/api.md`, `docs/events.md`, `docs/integration-model.md`, `packages/adapters/src/index.js` |
| Public current-state audit documented | PASS locally | `docs/current-state-audit.md` |

## Security And Privacy Evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| Working tree scan | PASS locally | `scripts/public-release-audit.sh`, local audit results |
| Git history scan | PASS locally | `docs/security/git-history-privacy-audit.md` |
| Author/committer metadata reviewed | PASS locally | `docs/security/git-history-privacy-audit.md`, `npm run release:local-gate` |
| No private remotes | PASS locally | `docs/security/git-history-privacy-audit.md`, `npm run release:local-gate` |
| No `.env`, backups, logs, runtime data | PASS locally | `.gitignore`, `scripts/public-release-audit.sh` |
| No real personal, client, Slack, Gmail, or machine details | PASS locally | `docs/security/git-history-privacy-audit.md`, public/private audit scans |
| No secret-shaped values | PASS locally | `docs/security/git-history-privacy-audit.md`, `scripts/public-release-audit.sh` |
| HTTP API auth policy reviewed | PASS locally | `docs/security/auth-policy.md`, `tests/api-auth.test.js` |
| Dependency audit reviewed | PASS locally | `npm audit --audit-level=high`, `npm run ci` |
| Database backup/restore procedure reviewed | PASS locally | `docs/storage-and-migrations.md`, database backup/restore tests |
| Threat model and data handling documented | PASS locally | `docs/security/threat-model.md`, `docs/security/data-handling.md` |

## Quality Evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| CI workflow configured locally | PASS locally | `.github/workflows/ci.yml`, `docs/ci-and-release-gates.md` |
| Clean checkout install | PASS locally | `docs/security/git-history-privacy-audit.md` |
| Tests pass | PASS locally | `npm test` |
| No separate build step required | PASS locally | Dependency-free web app documented in `docs/web-app.md` |
| Local CI passes | PASS locally | `npm run ci` |
| Local release gate command | PASS locally | `npm run release:local-gate` |
| Browser/accessibility verification | PASS locally | `docs/browser-accessibility-verification.md` |
| README quickstart | PASS locally | Clean-checkout quickstart evidence in `docs/security/git-history-privacy-audit.md` |
| Community health files | PASS locally | `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md` |
| Deployment, troubleshooting, roadmap docs | PASS locally | `docs/deployment.md`, `docs/troubleshooting.md`, `docs/roadmap.md` |

## GitHub Evidence Still Required

These gates require authenticated GitHub access and must not be marked complete
from local-only evidence:

- GitHub CLI authentication or equivalent GitHub web session.
- `ownerops-ai/ownerops` exists or can be created.
- Remote empty or inspected.
- No force push needed.
- Repository description set.
- Default branch `main`.
- GitHub-hosted CI passes.
- Final public-release security audit changes to `PASS`.

Use `docs/github-launch-runbook.md` for the exact sequence.

## Required Final Sequence

1. Run `npm run release:local-gate`.
2. Authenticate GitHub CLI with `gh auth login` or use an authenticated GitHub web session.
3. Inspect or create the GitHub repository with authenticated owner/org permissions.
4. Push `main` without force.
5. Wait for GitHub Actions.
6. Record hosted CI run URL and outcome.
7. Configure or record branch protection recommendations.
8. Run one final privacy/security scan.
9. Update `docs/security/public-release-security-audit.md` to `PASS` only if all critical and high-risk findings are resolved.
