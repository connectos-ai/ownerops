# API

OwnerOps includes a dependency-free HTTP API for self-hosted task operations. The API is intentionally standalone: it can run by itself, and DoBoth, ConnectOS, Slack, Gmail, or AI providers can connect later through the same public routes and adapter contracts.

## Run Locally

```bash
npm test
npm run check
OWNEROPS_PORT=3100 node apps/api/src/server.js
```

For local persistence, add `OWNEROPS_DATA_FILE`:

```bash
OWNEROPS_PORT=3100 OWNEROPS_DATA_FILE=data/ownerops.json node apps/api/src/server.js
```

Then open:

```text
http://localhost:3100/healthz
```

## Authentication

Local development is open by default. For exposed self-hosted API access, set `OWNEROPS_API_TOKEN` to a long random value. When set, OwnerOps requires:

```text
Authorization: Bearer <OWNEROPS_API_TOKEN>
```

for `/api/*` routes and `/slack/oauth/start`. Slack webhook routes (`/slack/events`, `/slack/interactions`, `/slack/commands`) use Slack request signatures instead. `/slack/oauth/callback` uses signed OAuth state because Slack redirects back without custom bearer headers.

## Current Routes

```text
GET    /healthz
POST   /api/workspaces
GET    /api/workspaces/:workspaceId
POST   /api/workspaces/:workspaceId/users
PATCH  /api/workspaces/:workspaceId/users/:userId
POST   /api/workspaces/:workspaceId/users/:userId/deactivate
POST   /api/workspaces/:workspaceId/projects
POST   /api/workspaces/:workspaceId/lists
POST   /api/tasks
GET    /api/tasks?workspaceId=:workspaceId
PATCH  /api/tasks/:taskId
PATCH  /api/tasks/:taskId/status
PATCH  /api/tasks/:taskId/assign
POST   /api/tasks/:taskId/comments
POST   /api/tasks/:taskId/subtasks
PATCH  /api/tasks/:taskId/subtasks/:subtaskId/status
POST   /api/tasks/:taskId/archive
POST   /api/tasks/:taskId/reopen
POST   /api/tasks/:taskId/merge-duplicate
POST   /api/tasks/:taskId/recurring-instance
POST   /api/tasks/:taskId/owner-decision
POST   /api/tasks/:taskId/owner-decision/resolve
GET    /api/boards/kanban?workspaceId=:workspaceId
POST   /api/triage/email
POST   /api/triage/suggestions/:suggestionId/approve
POST   /api/triage/suggestions/:suggestionId/reject
GET    /api/briefs/daily?workspaceId=:workspaceId&now=:isoTimestamp
GET    /api/briefs/weekly?workspaceId=:workspaceId
GET    /slack/oauth/start?workspaceId=:workspaceId
GET    /slack/oauth/callback?code=:code&state=:state
POST   /api/slack/messages
POST   /slack/events
POST   /slack/interactions
POST   /slack/commands
```

Task list routes support these filters: `query`, `ownerId`, `reviewerId`,
`approverId`, `userId`, `projectId`, `listId`, `status`, `tag`, `dueBefore`,
`dueAfter`, and `includeArchived=true`. `userId` matches any related person on
the task, including owner, requester, reviewer, approver, collaborator,
waiting-on, or subtask owner.

## Example Flow

Create a workspace:

```bash
curl -sS http://localhost:3100/api/workspaces \
  -H "authorization: Bearer $OWNEROPS_API_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"id":"workspace_demo","name":"Demo Team"}'
```

Create a user:

```bash
curl -sS http://localhost:3100/api/workspaces/workspace_demo/users \
  -H 'content-type: application/json' \
  -d '{"id":"user_owner","displayName":"Owner"}'
```

Invite or map a user without storing raw email:

```bash
curl -sS http://localhost:3100/api/workspaces/workspace_demo/users \
  -H 'content-type: application/json' \
  -d '{"id":"user_reviewer","displayName":"Reviewer","role":"guest","status":"invited","email":"reviewer@example.com","externalIds":{"slackUserId":"U_EXAMPLE"}}'
```

OwnerOps stores `emailHash`, external provider IDs, role, and lifecycle
status. It does not return or persist raw email addresses in public task
records.

Create a task:

```bash
curl -sS http://localhost:3100/api/tasks \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"workspace_demo","title":"Prepare launch checklist","createdBy":"user_owner","ownerId":"user_owner"}'
```

Add a comment:

```bash
curl -sS http://localhost:3100/api/tasks/task_example/comments \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"workspace_demo","authorId":"user_owner","body":"Waiting on final date."}'
```

View the Kanban board:

```bash
curl -sS 'http://localhost:3100/api/boards/kanban?workspaceId=workspace_demo'
```

## Integration Boundary

The API should not import DoBoth or ConnectOS code. If those systems connect to OwnerOps, they should use:

- REST routes in this document.
- Domain events described in `docs/events.md`.
- Adapter interfaces in `packages/adapters`.

That makes OwnerOps useful as a public project on its own while still making it natural to compose with broader operating systems.
