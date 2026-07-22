# Integration Model

OwnerOps is standalone first. Integrations add capabilities; they do not define
core task system. Same public adapter contracts are available to direct
providers, ConnectOS, DoBoth, and any other project.

```text
OwnerOps   owns tasks, delegation, triage, status, follow-up, briefs.
ConnectOS  may provide optional standardized access external tools.
DoBoth     may consume OwnerOps APIs and events broader owner outcomes.
```

OwnerOps must continue working when ConnectOS and DoBoth disconnected. ConnectOS
must not contain OwnerOps task logic. DoBoth must not be embedded OwnerOps.

## Integration Surfaces

Use these public surfaces before adding new coupling:

- REST API routes in `docs/api.md`.
- Domain events in `docs/events.md`.
- Adapter interfaces in `packages/adapters`.
- Slack app routes documented in `docs/slack-enhanced-app.md`.
- Slack-native manual templates in `templates/slack-free/` and
  `templates/slack-paid/`.

Do not add private backdoors, hidden feature flags, product-specific bypasses, or
undocumented behavior for one orchestrating product.

## Capability Ports

Adapter names should describe capability, not vendor or product strategy. Direct
providers and aggregator providers should satisfy same capability shape.

### CommunicationSource

```text
listMessages
readMessage
readThread
sendMessage
createDraft
searchMessages
```

Possible implementations: direct Slack, Microsoft Teams, ConnectOS
communication, mock communication.

### EmailSource

```text
listThreads
readThread
createDraft
sendDraft
archiveThread
applyLabel
```

Possible implementations: Gmail, Microsoft Graph mail, secure IMAP if justified,
ConnectOS email, mock email.

Default behavior should read, classify, summarize, recommend, and draft.
Sending, archiving, deleting, and label changes require explicit configuration
and workspace policy approval.

### CalendarSource

```text
listEvents
readEvent
createEvent
updateEvent
```

Calendar adapters add optional schedule awareness without turning OwnerOps into
calendar product.

### DirectorySource

```text
listUsers
findUser
resolveAssignee
mapExternalIdentity
deactivateUser
```

Directory adapters should avoid exposing personal email addresses in public
Slack channels or logs unless workspace policy allows it.

### AIProvider

```text
classifyWork
extractTasks
suggestAssignee
summarize
draftResponse
```

AI output is never authoritative by itself. OwnerOps validates structured output,
applies workspace policies, and requires approval before external side effects
when policy says approval needed.

### TaskDestination

```text
createTask
updateTask
assignTask
changeStatus
addComment
linkSource
```

Possible implementations: local OwnerOps task store, Slack List destination,
ConnectOS task destination, webhook destination.

## ConnectOS Adapter Boundary

ConnectOS adapter may provide standardized access to email, calendar, Slack,
files, CRM, or customer communication. It should be optional provider behind the
same capability ports direct providers use.

Rules:

- OwnerOps does not require ConnectOS start, triage mock email, manage tasks, run
  Slack app mode, or generate briefs.
- ConnectOS does not own OwnerOps task status, owner-decision policy, duplicate
  detection, or operating rhythm.
- If ConnectOS unavailable, direct provider adapters and mock adapters remain
  valid.

## DoBoth Orchestration Boundary

DoBoth may consume OwnerOps APIs and events to include operating work in larger
leadership experience. It should integrate like any other consumer.

Allowed:

- Read authorized tasks through public APIs.
- Subscribe to public events when webhook delivery exists.
- Submit authorized triage content through public routes.
- Create or update tasks using documented inputs.

Not allowed:

- Private routes bypass authorization.
- DoBoth-only task semantics hidden from other users.
- Direct imports from private DoBoth code.
- Product-specific event types unavailable to other consumers.

## Idempotency And Workspace Isolation

Every integration should:

- Scope data by `workspaceId`.
- Use idempotency keys for source imports and retries.
- Preserve source references without copying unnecessary private content.
- Treat provider payloads as untrusted input.
- Avoid logging full message bodies, tokens, credentials, or raw AI prompts.

## Minimal Integration Checklist

Before adding adapter, document:

- Capability port implemented.
- Required scopes or credentials.
- Data read and data written.
- Side effects and approval policy.
- Workspace isolation behavior.
- Backup or restore impact if it stores state.
- Test fixture using fictional data.
- Failure behavior when provider unavailable.
