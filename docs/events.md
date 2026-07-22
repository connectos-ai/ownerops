# Event Model

OwnerOps events describe work changes without requiring any specific integration.
They are for internal handlers, future webhooks, audit trails, optional ConnectOS
adapters, optional DoBoth orchestration, and other consumers. Every consumer uses
the same public event shape. There are no private product-specific events.

## Event Envelope

Every event should use this envelope:

```json
{
  "version": "2026-01-01",
  "eventId": "evt_example_123",
  "eventType": "task.status_changed",
  "workspaceId": "workspace_example_123",
  "occurredAt": "2026-01-01T12:00:00.000Z",
  "actorId": "user_example_123",
  "idempotencyKey": "workspace_example_123:task_example_123:status:2",
  "source": {
    "type": "ownerops",
    "reference": "task_example_123"
  },
  "data": {}
}
```

Required fields:

- `version`: event schema version. breaking changes require new version.
- `eventId`: unique event identifier.
- `eventType`: stable machine-readable event name.
- `workspaceId`: workspace or tenant context.
- `occurredAt`: ISO timestamp for event time.
- `idempotencyKey`: stable key consumers can use avoid duplicate handling.
- `data`: event-specific payload.

Recommended fields:

- `actorId`: OwnerOps user or system actor.
- `source`: minimal source pointer.
- `correlationId`: request, job, or import identifier for tracing.

## Privacy Rules

Events should carry enough data route and reconcile work, not enough leak private
communication.

- Prefer internal IDs and source references over message bodies.
- Include source URLs only when destination authorized see them.
- Do not include OAuth tokens, signing secrets, cookies, authorization headers,
  database URLs, raw prompts, or private attachment contents.
- Keep personal email addresses out public channels and logs unless workspace
  policy explicitly allows destination.
- Treat AI-generated fields recommendations. authorization and policy checks
  still happen in OwnerOps code.

## Core Task Events

```text
task.created
task.updated
task.assigned
task.reassigned
task.status_changed
task.priority_changed
task.due_date_changed
task.blocked
task.waiting
task.completed
task.reopened
task.archived
task.overdue
task.comment_added
task.source_added
task.duplicate_detected
task.duplicate_merged
```

Example:

```json
{
  "version": "2026-01-01",
  "eventId": "evt_task_created_001",
  "eventType": "task.created",
  "workspaceId": "workspace_demo",
  "occurredAt": "2026-01-01T12:00:00.000Z",
  "actorId": "user_owner",
  "idempotencyKey": "workspace_demo:source:email_demo_001",
  "source": {
    "type": "email",
    "reference": "email_demo_001"
  },
  "data": {
    "taskId": "task_demo_001",
    "title": "Send updated proposal",
    "ownerId": "user_owner",
    "status": "INBOX",
    "priority": "NORMAL"
  }
}
```

## Owner Decision Events

```text
task.owner_decision_requested
task.owner_decision_resolved
```

Decision events should include why owner is uniquely required and smallest
action needed from owner.

## Triage Events

```text
triage.item_received
triage.work_detected
triage.task_suggested
triage.task_approved
triage.task_rejected
triage.no_action
```

Triage events should explain inference without storing unnecessary private
content.

## Brief Events

```text
brief.generated
brief.delivered
```

Brief events should contain counts, IDs, and delivery metadata. Full brief body
should stay in authorized destination or fetched through authorized API route.

## Consumer Guidance

Event consumers should:

- Deduplicate by `idempotencyKey` or `eventId`.
- Scope every action to `workspaceId`.
- Treat event payloads as untrusted input at integration boundaries.
- Fetch details through authorized APIs when workflow needs more data.
- Handle unknown additive fields without failing.
- Ignore event types they do not understand.
- Never assume event order across workers unless delivery mechanism guarantees it.
