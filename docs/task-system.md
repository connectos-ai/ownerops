# Task System

OwnerOps starts as a task manager before it becomes an integration system.

## Core Views

- Inbox
- Today
- Upcoming
- Waiting
- Blocked
- Needs Owner
- Completed
- Projects
- Kanban board

## Statuses

- `INBOX`
- `NEEDS_CLARIFICATION`
- `READY`
- `IN_PROGRESS`
- `WAITING`
- `BLOCKED`
- `NEEDS_OWNER`
- `DONE`
- `CANCELLED`

## Priorities

- `CRITICAL`
- `HIGH`
- `NORMAL`
- `LOW`

## Required Behaviors

- Create a task manually.
- Assign and reassign one accountable owner.
- Add collaborators.
- Set priority, due date, start date, project, tags, and next action.
- Mark waiting or blocked with a reason.
- Request and resolve owner decisions.
- Complete, reopen, cancel, and archive.
- Preserve comments and task event history.
- Link to the source message or email when available.
- Prevent accidental duplicate creation using source IDs and idempotency keys.

## Conflict Strategy

Tasks include a `version` field. Updates must provide the current version or use another explicit idempotency/concurrency strategy. Conflicting writes should fail safely and ask the client to reload.
