# OwnerOps

OwnerOps is an open-source owner-operator triage and task system. It helps owners, leaders, managers, pastors, and small teams turn communication into clear work: what needs to be done, who owns it, what is blocked, what is waiting, and what truly needs the owner.

OwnerOps is designed to work independently. It does not require DoBoth, ConnectOS, Slack, email, or an AI model to be useful. Those capabilities can be connected later through documented public APIs, webhooks, and adapters.

## What OwnerOps Does

- Manage personal and team tasks.
- Track projects, lists, Kanban boards, assignees, priorities, due dates, blocked work, waiting work, and owner decisions.
- Triage email or message content when authorized.
- Suggest tasks, owners, due dates, priorities, and draft replies.
- Preserve source links and task history.
- Produce daily briefs and weekly operating reviews.
- Support Slack-native operating workflows using native Slack features.

## Operating Modes

### Level 1: Standalone Task Manager

Use OwnerOps without Slack, email, AI, DoBoth, or ConnectOS. Create projects, lists, tasks, comments, subtasks, assignments, due dates, recurring task instances, archived tasks, Kanban boards, daily briefs, and weekly reviews.

### Level 2: Slack-Native OwnerOps

Use Slack as the operating surface. Free workspaces can use channels, messages, threads, reactions, pins/bookmarks, search, and channel/DM canvases. Paid workspaces can add Slack Lists and Workflow Builder.

### Level 3: OwnerOps Enhanced System

Install the OwnerOps app/service for email triage, Slack commands, message shortcuts, interactions, task synchronization, reminders, daily briefs, and optional AI-assisted work detection.

### Level 4: Composable Operations Layer

DoBoth and ConnectOS can connect OwnerOps through public APIs, webhooks, and adapter interfaces. Neither is required.

## Standalone And Composable

OwnerOps, ConnectOS, and DoBoth are independent but complementary:

- OwnerOps owns work triage, task state, Slack-native workflows, and owner operating rhythm.
- ConnectOS may provide optional standardized connectors.
- DoBoth may orchestrate broader owner outcomes using OwnerOps events and APIs.

OwnerOps must remain useful when DoBoth and ConnectOS are disconnected. When they are connected, they use the same public integration surfaces available to any other project; there are no private DoBoth backdoors or hidden ConnectOS dependencies.

## Slack-Native Task Options

- Free Slack: use Slack Free starter templates in `templates/slack-free/`.
- Paid Slack: use Slack Lists, Workflow Builder, and canvas templates in `templates/slack-paid/`.
- Enhanced Slack app: use OwnerOps app integrations when you want automation.

See `docs/slack-capability-matrix.md` before choosing a Slack setup.
See `docs/slack-enhanced-app.md` for the current signed-request Slack command interaction slice.

## Current Status

This repository is a public open-source release candidate. Do not treat it as release-ready until `docs/security/public-release-security-audit.md` reports `PASS`.

## Quickstart

Run current local checks:

```bash
npm ci
npm test
npm run check
npm run ci
```

Start the standalone API:

```bash
OWNEROPS_PORT=3100 node apps/api/src/server.js
```

For local persistence, add `OWNEROPS_DATA_FILE=data/ownerops.json`.

For exposed self-hosted API access, set `OWNEROPS_API_TOKEN` and send `Authorization: Bearer <token>` on `/api/*` requests.

For PostgreSQL persistence, opt in explicitly:

```bash
OWNEROPS_STORAGE=postgres DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops node apps/api/src/server.js
```

Back up and restore-test PostgreSQL before production moves:

```bash
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops npm run db:backup
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops OWNEROPS_RESTORE_TEST_DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops_restore_test npm run db:restore-test
```

Then visit `http://localhost:3100/` for the standalone task manager or `http://localhost:3100/healthz` for the health check.

See:

- `docs/architecture.md`
- `docs/api.md`
- `docs/events.md`
- `docs/integration-model.md`
- `docs/current-state-audit.md`
- `docs/self-hosting.md`
- `docs/deployment.md`
- `docs/troubleshooting.md`
- `docs/roadmap.md`
- `docs/web-app.md`
- `docs/browser-accessibility-verification.md`
- `docs/release-evidence-index.md`
- `docs/github-launch-runbook.md`
- `docs/storage-and-migrations.md`
- `docs/ci-and-release-gates.md`
- `docs/security/auth-policy.md`
- `docs/security/threat-model.md`
- `docs/security/data-handling.md`
- `docs/security/git-history-privacy-audit.md`
- `docs/slack-enhanced-app.md`
- `docs/permissions-and-scopes.md`
- `docs/product-verification.md`
- `docs/task-system.md`
- `docs/email-triage.md`
- `docs/slack-native-starter-guide.md`
- `docs/public-release-checklist.md`

## License

Apache License 2.0. See `LICENSE`.
