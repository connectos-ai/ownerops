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

## Current Routes

```text
GET    /healthz
POST   /api/workspaces
POST   /api/workspaces/:workspaceId/users
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
POST   /api/tasks/:taskId/recurring-instance
POST   /api/tasks/:taskId/owner-decision
POST   /api/tasks/:taskId/owner-decision/resolve
GET    /api/boards/kanban?workspaceId=:workspaceId
POST   /api/triage/email
POST   /api/triage/suggestions/:suggestionId/approve
GET    /api/briefs/daily?workspaceId=:workspaceId&now=:isoTimestamp
GET    /api/briefs/weekly?workspaceId=:workspaceId
GET    /slack/oauth/start?workspaceId=:workspaceId
GET    /slack/oauth/callback?code=:code&state=:state
POST   /api/slack/messages
POST   /slack/events
POST   /slack/interactions
POST   /slack/commands
```

Task list routes support these filters: `query`, `ownerId`, `projectId`, `listId`, `status`, `tag`, `dueBefore`, `dueAfter`, and `includeArchived=true`.

## Example Flow

Create a workspace:

```bash
curl -sS http://localhost:3100/api/workspaces \
  -H 'content-type: application/json' \
  -d '{"id":"workspace_demo","name":"Demo Team"}'
```

Create a user:

```bash
curl -sS http://localhost:3100/api/workspaces/workspace_demo/users \
  -H 'content-type: application/json' \
  -d '{"id":"user_owner","displayName":"Owner"}'
```

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
- Domain events described in `docs/architecture.md`.
- Adapter interfaces in `packages/adapters`.

That makes OwnerOps useful as a public project on its own while still making it natural to compose with broader operating systems.
