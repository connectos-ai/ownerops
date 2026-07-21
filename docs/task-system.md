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

- Create tasks manually.
- Assign and reassign one accountable owner.
- Add collaborators.
- Create projects and lists for standalone personal or team organization.
- Set priority, due date, start date, project, list, tags, and next action.
- Add comments and subtasks to keep activity attached to the work.
- Mark tasks waiting or blocked with a reason.
- Request and resolve owner decisions.
- Complete, reopen, cancel, and archive tasks.
- Preserve comments and task event history.
- Link source message or email when available.
- Search and filter by text, owner, project, list, status, tag, due date, and archived state.
- Generate recurring task instances from an existing task template.
- Prevent accidental duplicate creation using source IDs or idempotency keys.

## Conflict Strategy

Tasks include a `version` field. Updates must provide the current version or use another explicit idempotency/concurrency strategy. Conflicting writes should fail safely and ask the client to reload.
