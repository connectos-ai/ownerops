# Public Release Checklist

OwnerOps may not be published until every item is complete.

## Product

- [x] Standalone task manager works without Slack, email, AI, DoBoth, or ConnectOS.
- [x] Static standalone web app served by local API.
- [x] Workspace, member, project, and list setup available in standalone web app.
- [x] Relational schema, adapter, and migration runner documented without requiring database service for local JSON use.
- [x] Slack Free native templates usable manually.
- [x] Slack paid templates are documented accurately.
- [x] Enhanced Slack app mode is optional.
- [x] Email triage works through mock provider/configured provider boundary.
- [x] Daily and weekly briefs work from task data.
- [x] DoBoth and ConnectOS optional adapters only.

## Security And Privacy

- [x] Working tree scan passes.
- [x] Git history scan passes.
- [x] Author/committer metadata reviewed.
- [x] No private remotes.
- [x] No `.env`, backups, logs, runtime data.
- [x] No real personal, client, church, Slack, Gmail, machine details.
- [x] No secrets secret-shaped values.
- [x] HTTP API auth policy reviewed.
- [x] Dependency audit reviewed.
- [x] Database backup/restore procedure reviewed.
- [ ] `docs/security/public-release-security-audit.md` says `PASS`.

## Quality

- [x] CI workflow configured locally.
- [x] Install succeeds clean checkout.
- [x] Tests pass.
- [x] No separate build step required for dependency-free web app.
- [x] CI passes locally.
- [x] Browser/accessibility verification complete for standalone web app.
- [x] README quickstart works.
- [x] License, security policy, contribution guide, and code conduct present.
- [x] GitHub issue and pull request templates present.

## GitHub

- [ ] `ownerops-ai/ownerops` exists or can be created.
- [ ] Remote is empty or inspected.
- [ ] No force push needed.
- [ ] Repository description set.
- [ ] Default branch `main`.
- [x] Branch protection recommendations documented.
