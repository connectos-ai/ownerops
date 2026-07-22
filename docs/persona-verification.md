# Persona Verification

Date: 2026-07-22

Status: PASS locally for public-release candidate personas; GitHub publication
evidence remains pending.

This document maps the required fictional product personas to current OwnerOps
evidence. It does not introduce private examples or customer data.

## Persona Matrix

| Persona | Expected value | Evidence |
| --- | --- | --- |
| Solo user | Create a personal task, set dates, track status, complete/reopen work without Slack, email, AI, DoBoth, or ConnectOS | `tests/standalone-task-manager.test.js`, `tests/web-standalone-ui.test.js`, `docs/task-system.md`, `docs/web-app.md` |
| Small team | Create workspace members, projects, lists, assignments, Kanban board, comments, subtasks, daily/weekly summaries | `tests/standalone-task-manager.test.js`, `tests/workspace-setup.test.js`, `tests/core-workspace.test.js`, `docs/task-system.md`, `docs/kanban.md` |
| Slack Free team | Use native channels, messages, reactions, threads, channel/DM canvases, daily rituals, and weekly rituals without relying on Slack Lists or Workflow Builder | `docs/slack-native-starter-guide.md`, `docs/slack-capability-matrix.md`, `templates/slack-free/` |
| Slack plan-aware enhancement team | Use Slack Lists, Workflow Builder, canvases, and templates as stronger native task intake/tracking surfaces when enabled for the target workspace | `docs/slack-paid-enhancements.md`, `docs/slack-capability-matrix.md`, `templates/slack-paid/` |
| AI email triage user | Review detected work from authorized email, inspect explanation, approve suggested task, keep AI optional | `tests/triage-vertical-slice.test.js`, `tests/api-vertical-slice.test.js`, `docs/email-triage.md`, `docs/security/threat-model.md` |
| Owner with multiple team members | Assign work to different users, track requester/reviewer/approver/collaborator relationships, see delegated work by person | `tests/standalone-task-manager.test.js`, `tests/workspace-setup.test.js`, `tests/relational-store.test.js`, `docs/task-system.md` |
| DoBoth user | Consume OwnerOps through documented public APIs/events without any private DoBoth dependency | `docs/api.md`, `docs/events.md`, `docs/integration-model.md`, `docs/architecture.md` |
| ConnectOS user | Use ConnectOS only as optional provider capability while OwnerOps continues with direct/mock adapters | `docs/integration-model.md`, `docs/email-triage.md`, `packages/adapters/src/index.js`, `tests/triage-vertical-slice.test.js` |

## Limits

- This is local release-candidate evidence only.
- It does not replace browser/accessibility verification, security audit, or
  GitHub-hosted CI evidence.
- It does not publish, push, or create the public GitHub repository.
