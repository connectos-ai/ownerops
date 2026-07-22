# Architecture

OwnerOps is a standalone owner-operator work system with optional integrations.

## Layering

```text
apps/
  api/      HTTP API, webhooks, Slack request handlers
  web/      Standalone task manager and Kanban UI
  worker/   Scheduler, reminders, briefs, background work

packages/
  core/     Domain models, policies, events
  triage/   Work detection, owner-decision filter, summaries
  storage/  JSON store, relational adapter, migrations
  slack/    Slack signing, payload parsing, interaction handlers
  adapters/ Slack, email, AI, task destination, ConnectOS ports
```

The domain layer must not depend on Slack SDK objects, Gmail API objects, DoBoth code, or ConnectOS code.

## Independence Rule

OwnerOps must start providing value without:

- Slack.
- Email.
- AI.
- DoBoth.
- ConnectOS.
- Paid Slack features.

Integrations add capabilities. They do not define the core product.

## Composability

DoBoth and ConnectOS can integrate through the same public interfaces available to anyone:

- REST APIs.
- Webhooks.
- Domain events.
- Adapter interfaces.
- Public examples.

There are no private DoBoth backdoors and no hidden ConnectOS dependency.

## Capability Ports

```text
CommunicationSource
  listMessages
  readMessage
  readThread
  sendMessage
  createDraft
  searchMessages

EmailSource
  listThreads
  readThread
  createDraft
  sendDraft
  archiveThread
  applyLabel

AIProvider
  classifyWork
  extractTasks
  suggestAssignee
  summarize
  draftResponse

TaskDestination
  createTask
  updateTask
  assignTask
  changeStatus
```

Potential implementations include direct Slack, direct Gmail, Microsoft Graph, mock providers, local deterministic rules, OpenAI-compatible providers, local model providers, and optional ConnectOS providers.

## Slack Enhanced Boundary

Slack request verification and interaction parsing live in `packages/slack`. The API app exposes `/slack/events` and `/slack/interactions`, but task updates still go through the canonical core task model and storage layer. Slack-specific payloads must not leak into core task logic.

## Storage Boundary

OwnerOps can run from the local JSON store for development and trials. Production persistence uses versioned SQL migrations in `packages/storage/src/relational-schema.js`, the async relational store in `packages/storage/src/relational-store.js`, and optional PostgreSQL wiring in `packages/storage/src/postgres.js`.

The schema is workspace-scoped, covers the canonical task system and Slack installation state, and requires encrypted credential records instead of plaintext integration secrets. The relational path has migration and transaction tests for task writes, Slack idempotency, and triage approvals.

The REST API awaits async store operations when an async store is supplied. Production deployments can select the database runtime with `OWNEROPS_STORAGE=postgres`; database backup and restore procedures are still pending, so the public release gate remains `FAIL`.

## Standalone Web Boundary

The API server serves a static web task manager from `apps/web`. It supports workspace setup, team members, projects, lists, manual task capture, owner assignment, priority and due date entry, search, filtered views, summary counts, and Kanban status moves through public API. It is dependency-free so a new contributor can run OwnerOps locally without a separate frontend build.

## Canonical Data Model

OwnerOps keeps a canonical task model even when tasks are mirrored into Slack. Minimum task fields:

- `id`.
- `workspaceId`.
- `title`.
- `description`.
- `desiredOutcome`.
- `sourceType`.
- `sourceReference`.
- `sourceUrl`.
- `createdBy`.
- `ownerId`.
- `requestedBy`.
- `collaborators`.
- `status`.
- `priority`.
- `dueAt`.
- `startAt`.
- `completedAt`.
- `blockedReason`.
- `waitingOn`.
- `projectId`.
- `tags`.
- `ownerDecisionRequired`.
- `ownerDecisionReason`.
- `confidence`.
- `createdAt`.
- `updatedAt`.
- `version`.

## Domain Events

Events are versioned, workspace-scoped, idempotent, and suitable for optional webhooks or future DoBoth orchestration.

```json
{
  "version": "2026-01-01",
  "eventType": "task.status_changed",
  "eventId": "evt_example_123",
  "workspaceId": "workspace_example_123",
  "occurredAt": "2026-01-01T12:00:00.000Z",
  "actorId": "user_example_123",
  "taskId": "task_example_123",
  "previousStatus": "READY",
  "nextStatus": "IN_PROGRESS"
}
```
