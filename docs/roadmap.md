# Roadmap

OwnerOps should stay useful alone while becoming easier to connect. This roadmap
is intentionally scoped to owner-operator triage, task ownership, Slack-native
workflow, email-to-task conversion, operating briefs, and public integrations.

## Current Release Candidate

- Standalone task manager.
- Static web app served by local API.
- Manual Slack Free templates.
- Slack plan-aware enhancement templates and capability matrix.
- Enhanced Slack app request verification, commands, shortcuts, modals, App Home,
  outgoing messages, OAuth, encrypted installation tokens.
- Mock email triage and approval-to-task flow.
- Daily and weekly briefs from task data.
- Local JSON store and optional PostgreSQL store.
- Backup, restore, and restore-test scripts.
- Public API, event, and integration model docs.

## Before Public Launch

- Authenticate GitHub CLI or use authenticated GitHub web session.
- Inspect or create `ownerops-ai/ownerops`.
- Push `main` without force only after final gates pass.
- Capture GitHub-hosted CI evidence.
- Record branch protection settings.
- Run final privacy and secret scans.
- Change `docs/security/public-release-security-audit.md` to `PASS` only after
  all critical and high-risk findings are resolved.

## Near-Term Improvements

- Add first-party user login or documented reverse-proxy auth recipe.
- Add role checks for workspace administrator and member actions.
- Add webhook delivery for documented domain events.
- Add richer task history and audit event views.
- Add scheduler-backed reminders and overdue checks.
- Add provider examples for Gmail and Microsoft Graph using fictional fixtures.
- Add optional ConnectOS adapter example behind capability ports.
- Add DoBoth consumer example that uses public APIs and events only.

## Out Of Scope For This Repository

- CRM, sales platform, payroll, accounting, billing, marketing automation.
- General-purpose AI agent framework.
- Private DoBoth leadership intelligence or proprietary strategy.
- Private ConnectOS implementation.
- Customer data, private prompts, private workflows, or organization-specific
  playbooks.
