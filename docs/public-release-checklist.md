# Public Release Checklist

OwnerOps may not be published until every item is complete.

## Product

- [ ] Standalone task manager works without Slack, email, AI, DoBoth, or ConnectOS.
- [x] Relational schema boundary documented without requiring a database service.
- [ ] Slack Free native templates are usable manually.
- [ ] Slack paid templates are documented accurately.
- [ ] Enhanced Slack app mode is optional.
- [ ] Email triage works through mock provider or configured provider.
- [ ] Daily and weekly briefs work from task data.
- [ ] DoBoth and ConnectOS are optional adapters only.

## Security And Privacy

- [ ] Working tree scan passes.
- [ ] Git history scan passes.
- [ ] Author/committer metadata reviewed.
- [ ] No private remotes.
- [ ] No `.env`, backups, logs, or runtime data.
- [ ] No real personal, client, church, Slack, Gmail, or machine details.
- [ ] No secrets or secret-shaped values.
- [ ] Dependency audit reviewed.
- [ ] `docs/security/public-release-security-audit.md` says `PASS`.

## Quality

- [x] CI workflow configured locally.
- [ ] Install succeeds from clean checkout.
- [ ] Tests pass.
- [ ] Build passes.
- [ ] CI passes.
- [ ] README quickstart works.
- [ ] License, security policy, contribution guide, and code of conduct are present.

## GitHub

- [ ] `ownerops-ai/ownerops` exists or can be created.
- [ ] Remote is empty or inspected.
- [ ] No force push needed.
- [ ] Repository description is set.
- [ ] Default branch is `main`.
- [ ] Branch protection recommendations documented.
