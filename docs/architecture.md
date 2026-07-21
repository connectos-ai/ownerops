# Architecture

OwnerOps is a standalone owner-operator work system with optional integrations.

## Layering

```text
apps/
  api/       HTTP API, webhooks, Slack request handlers
  web/       Standalone task manager and Kanban UI
  worker/    Scheduler, reminders, briefs, background work

packages/
  core/      Domain models, policies, events
  triage/    Work detection, owner-decision filter, summaries
  adapters/  Slack, email, AI, task destination, ConnectOS ports
```

The domain layer must not depend on Slack SDK objects, Gmail API objects, DoBoth code, or ConnectOS code.

## Independence Rule

OwnerOps must start and provide value without:

- Slack
- Email
- AI
- DoBoth
- ConnectOS
- Paid Slack features

Integrations add capabilities. They do not define the core product.

## Composability

DoBoth and ConnectOS can integrate through the same public interfaces available to anyone:

- REST APIs
- Webhooks
- Domain events
- Adapter interfaces
- Public examples

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

## Canonical Data Model

OwnerOps keeps the canonical task model even when tasks are mirrored into Slack.

Minimum task fields:

- `id`
- `workspaceId`
- `title`
- `description`
- `desiredOutcome`
- `sourceType`
- `sourceReference`
- `sourceUrl`
- `createdBy`
- `ownerId`
- `requestedBy`
- `collaborators`
- `status`
- `priority`
- `dueAt`
- `startAt`
- `completedAt`
- `blockedReason`
- `waitingOn`
- `projectId`
- `tags`
- `ownerDecisionRequired`
- `ownerDecisionReason`
- `confidence`
- `createdAt`
- `updatedAt`
- `version`

## Domain Events

Events are versioned, workspace-scoped, idempotent, and privacy-conscious.

Required event families:

- `task.created`
- `task.updated`
- `task.assigned`
- `task.reassigned`
- `task.status_changed`
- `task.blocked`
- `task.waiting`
- `task.completed`
- `task.reopened`
- `task.overdue`
- `task.owner_decision_requested`
- `task.owner_decision_resolved`
- `triage.item_received`
- `triage.work_detected`
- `triage.task_suggested`
- `triage.task_approved`
- `triage.task_rejected`
- `brief.generated`

Example:

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
