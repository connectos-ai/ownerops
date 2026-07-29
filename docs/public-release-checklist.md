# Public Release Checklist

OwnerOps is published only after every item below is complete.

## Product

- [x] Standalone task manager works without Slack, email, AI, DoBoth, or
  ConnectOS.
- [x] Static standalone web app is served by the local API.
- [x] Workspace, member, project, and list setup are available in the standalone
  web app.
- [x] Workspace user invitation, role/status lifecycle, privacy-safe identity
  mapping, and deactivation API are tested.
- [x] Task requester, reviewer, approver, collaborator, and related-user
  filtering are tested while preserving one accountable owner.
- [x] Relational schema, adapter, and migration runner are documented without
  requiring database service for local JSON use.
- [x] Slack Free native templates are usable manually.
- [x] Slack plan-aware enhancement templates are documented accurately.
- [x] Enhanced Slack app mode is optional.
- [x] Email triage works through mock provider/configured provider boundary.
- [x] Email triage suggestions include deterministic explanation metadata and
  due-date inference.
- [x] Email triage flags prompt-injection-like source content as untrusted review
  metadata.
- [x] Triage suggestions can be approved or rejected, and duplicate tasks can be
  merged without deleting task history.
- [x] Daily and weekly briefs work from task data.
- [x] DoBoth and ConnectOS are optional adapters only.
- [x] Public event model is documented.
- [x] Capability-based integration model is documented.
- [x] Required fictional personas are mapped in public docs/tests.
- [x] Objective coverage audit maps release requirements to evidence.
- [x] Public current-state audit is documented.
- [x] Reusable Slack templates use fictional examples.

## Security And Privacy

- [x] Working tree scan passes.
- [x] Git history scan passes.
- [x] Author/committer metadata reviewed.
- [x] No private remotes.
- [x] No `.env`, backups, logs, or runtime data.
- [x] No real personal, client, Slack, Gmail, or machine details.
- [x] Workspace user email handling stores hashes instead of raw email.
- [x] Dependency audit reviewed.
- [x] Database backup/restore procedure reviewed.
- [x] `docs/security/public-release-security-audit.md` says `PASS`.

## Quality

- [x] CI workflow configured locally.
- [x] Install succeeds from clean checkout.
- [x] Tests pass.
- [x] No separate build step required for dependency-free web app.
- [x] CI passes locally.
- [x] Browser/accessibility verification complete for standalone web app.
- [x] README quickstart works.
- [x] License, security policy, contribution guide, and code of conduct present.
- [x] GitHub issue and pull request templates present.
- [x] Generic CODEOWNERS file present.
- [x] Release evidence index created.
- [x] Local release gate command exists.
- [x] Public API, event, and integration boundaries documented.
- [x] Deployment, troubleshooting, and roadmap docs present.
- [x] Threat model and data-handling docs present.
- [x] Dependency update configuration present.

## GitHub

- [x] GitHub CLI authenticated or GitHub web session available.
- [x] `connectos-ai/ownerops` exists.
- [x] Remote was absent before creation and first push.
- [x] Remote added intentionally after inspection.
- [x] No force push needed.
- [x] Repository description set.
- [x] Default branch `main`.
- [x] GitHub-hosted CI passes.
- [x] Branch protection recommendations documented.
- [x] Branch protection state recorded.
