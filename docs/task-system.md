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
- Invite, activate, map, and deactivate workspace users without deleting task
  history.
- Assign and reassign one accountable owner.
- Add collaborators.
- Create projects and lists for standalone personal or team organization.
- Set priority, due date, start date, project, list, tags, and next action.
- Add comments and subtasks to keep activity attached to the work.
- Mark tasks waiting or blocked with a reason.
- Request and resolve owner decisions.
- Complete, reopen, cancel, and archive tasks.
- Reject non-actionable triage suggestions and merge duplicate tasks without
  silently losing task history.
- Preserve comments and task event history.
- Link source message or email when available.
- Search and filter by text, owner, project, list, status, tag, due date, and archived state.
- Generate recurring task instances from an existing task template.
- Prevent accidental duplicate creation using source IDs or idempotency keys.

## Task Relationships

Every task keeps one accountable `ownerId`. It may also include `requestedBy`,
`reviewerId`, `approverId`, `collaborators`, and `waitingOn` so teams can
review work by the person who requested it, who reviews it, who approves it,
who helps with it, or who is blocking it. Task search supports `ownerId`,
`reviewerId`, `approverId`, and `userId`; `userId` matches any related person
on the task.

## Workspace Users

Workspace users can be `admin`, `member`, or `guest`, and may be `invited`,
`active`, or `deactivated`. Tasks keep user IDs as history-preserving
references, so deactivating a user does not erase past ownership, comments, or
decisions.

User records may include Slack IDs or other external provider IDs. Raw email
addresses are converted to `emailHash` before storage so OwnerOps can match an
authorized provider identity without exposing personal email addresses in task
records, public channels, logs, or examples.

## Conflict Strategy

Tasks include a `version` field. Updates must provide the current version or use another explicit idempotency/concurrency strategy. Conflicting writes should fail safely and ask the client to reload.
