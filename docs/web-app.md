# Standalone Web App

OwnerOps includes dependency-free web task manager served by API server. It is Level 1 experience for users who want simple task manager before connecting Slack, email, AI, DoBoth, or ConnectOS.

Run locally:

```bash
OWNEROPS_PORT=3100 OWNEROPS_DATA_FILE=data/ownerops.json node apps/api/src/server.js
```

Open:

```text
http://localhost:3100/
```

## Current Capabilities

- Manual task creation.
- Accountable owner selection.
- Priority due date entry.
- Search and quick filters.
- Summary counts for open, due today, blocked, owner-decision work.
- Kanban columns backed by canonical `/api/boards/kanban` endpoint.
- Status moves through canonical task status API.

## Current Limitations

- First slice uses fictional demo workspace and users.
- Workspace, user, project, list management screens still pending.
- Browser accessibility responsive visual verification must be completed before public release `PASS`.
