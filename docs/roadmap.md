# Roadmap

OwnerOps should stay useful alone while becoming easier to connect. This roadmap
is intentionally scoped to owner-operator triage, task ownership, Slack-native
workflow, email-to-task conversion, operating briefs, and public integrations.

## Current Release

- Public repository: `https://github.com/connectos-ai/ownerops`.
- Standalone task manager.
- Static web app served by the local API.
- Manual Slack Free templates.
- Slack plan-aware enhancement templates and capability matrix.
- Enhanced Slack app request verification, commands, shortcuts, modals, App
  Home, outgoing messages, OAuth, and encrypted installation tokens.
- Mock email triage approval-to-task flow.
- Daily and weekly briefs from task data.
- Local JSON store and optional PostgreSQL store.
- Backup, restore, and restore-test scripts.
- Public API, event, and integration model docs.
- GitHub-hosted CI passes.
- Final public-release security audit is `PASS`.
- Branch protection recommendations are documented; branch protection is not
  enabled yet to match current sibling repository posture.

## Near-Term Improvements

- Add first-party user login or documented reverse-proxy auth recipe.
- Add role checks for workspace administrator/member actions.
- Add webhook delivery for documented domain events.
- Add richer task history audit event views.
- Add scheduler-backed reminders and overdue checks.
- Add provider examples for Gmail and Microsoft Graph using fictional fixtures.
- Add optional ConnectOS adapter example behind capability ports.
- Add DoBoth consumer example through public APIs and events only.

## Out Of Scope For Repository

- CRM, sales platform, payroll, accounting, billing, or marketing automation.
- General-purpose AI agent framework.
- Private DoBoth leadership intelligence or proprietary strategy.
- Private ConnectOS implementation.
