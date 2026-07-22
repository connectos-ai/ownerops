# Public Release Checklist

OwnerOps may not be published until every item is complete.

## Product

- [x] Standalone task manager works without Slack, email, AI, DoBoth, or ConnectOS.
- [x] Static standalone web app served by local API.
- [x] Workspace, member, project, and list setup available in standalone web app.
- [x] Workspace user invitation, role/status lifecycle, privacy-safe identity mapping, and deactivation API tested.
- [x] Task requester, reviewer, approver, collaborator, and related-user filtering tested while preserving one accountable owner.
- [x] Relational schema, adapter, and migration runner documented without requiring database service for local JSON use.
- [x] Slack Free native templates usable manually.
- [x] Slack paid templates are documented accurately.
- [x] Enhanced Slack app mode is optional.
- [x] Email triage works through mock provider/configured provider boundary.
- [x] Email triage suggestions include deterministic explanation metadata and due-date inference.
- [x] Email triage flags prompt-injection-like source content as untrusted review metadata.
- [x] Triage suggestions can be approved or rejected, and duplicate tasks can be merged without deleting task history.
- [x] Daily and weekly briefs work from task data.
- [x] DoBoth and ConnectOS are optional adapters only.
- [x] Public event model documented.
- [x] Capability-based integration model documented.
- [x] Public current-state audit documented.
- [x] Reusable Slack templates with fictional examples are present.

## Security And Privacy

- [x] Working tree scan passes.
- [x] Git history scan passes.
- [x] Author/committer metadata reviewed.
- [x] No private remotes.
- [x] No `.env`, backups, logs, or runtime data.
- [x] No real personal, client, church, Slack, Gmail, or machine details.
- [x] No secrets or secret-shaped values.
- [x] HTTP API auth policy reviewed.
- [x] Privacy-conscious log redaction utility tested.
- [x] Workspace user email handling stores hashes instead of raw email.
- [x] Dependency audit reviewed.
- [x] Database backup/restore procedure reviewed.
- [ ] `docs/security/public-release-security-audit.md` says `PASS`.

## Quality

- [x] CI workflow configured locally.
- [x] Install succeeds from a clean checkout.
- [x] Tests pass.
- [x] No separate build step required for dependency-free web app.
- [x] CI passes locally.
- [x] Browser/accessibility verification complete for standalone web app.
- [x] README quickstart works.
- [x] License, security policy, contribution guide, and code conduct present.
- [x] GitHub issue and pull request templates present.
- [x] Generic CODEOWNERS file present.
- [x] Release evidence index created.
- [x] Local release gate command exists.
- [x] Public API, event, and integration boundaries documented.
- [x] Deployment, troubleshooting, and roadmap docs present.
- [x] Threat model and data-handling docs present.
- [x] Dependency update configuration present.

## GitHub

- [ ] GitHub CLI authenticated or GitHub web session available.
- [ ] `ownerops-ai/ownerops` exists or can be created.
- [ ] Remote is empty or inspected.
- [ ] Remote added intentionally after inspection.
- [ ] No force push needed.
- [ ] Repository description set.
- [ ] Default branch `main`.
- [ ] GitHub-hosted CI passes.
- [x] Branch protection recommendations documented.
