# Public Release Checklist

OwnerOps may not be published until every item is complete.

## Product

- [ ] Standalone task manager works without Slack, email, AI, DoBoth, or ConnectOS.
- [x] Static standalone web app served by local API.
- [x] Workspace, member, project, and list setup available in standalone web app.
- [x] Relational schema, adapter, and migration runner documented without requiring database service for local JSON use.
- [ ] Slack Free native templates usable manually.
- [ ] Slack paid templates are documented accurately.
- [ ] Enhanced Slack app mode is optional.
- [ ] Email triage works through mock provider configured provider.
- [ ] Daily weekly briefs work from task data.
- [ ] DoBoth ConnectOS optional adapters only.

## Security And Privacy

- [ ] Working tree scan passes.
- [ ] Git history scan passes.
- [ ] Author/committer metadata reviewed.
- [ ] No private remotes.
- [ ] No `.env`, backups, logs, runtime data.
- [ ] No real personal, client, church, Slack, Gmail, machine details.
- [ ] No secrets secret-shaped values.
- [x] HTTP API auth policy reviewed.
- [ ] Dependency audit reviewed.
- [x] Database backup/restore procedure reviewed.
- [ ] `docs/security/public-release-security-audit.md` says `PASS`.

## Quality

- [x] CI workflow configured locally.
- [ ] Install succeeds clean checkout.
- [ ] Tests pass.
- [ ] Build passes.
- [ ] CI passes.
- [ ] README quickstart works.
- [ ] License, security policy, contribution guide, code conduct present.

## GitHub

- [ ] `ownerops-ai/ownerops` exists or can be created.
- [ ] Remote is empty or inspected.
- [ ] No force push needed.
- [ ] Repository description set.
- [ ] Default branch `main`.
- [ ] Branch protection recommendations documented.
