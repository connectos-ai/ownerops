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

- Workspace creation and selection.
- Team member creation.
- Project and list creation.
- Manual task creation.
- Accountable owner selection.
- Project and list selection.
- Priority and due date entry.
- Search and quick filters.
- Summary counts for open, due today, blocked, and owner-decision work.
- Kanban columns rendered from canonical task list API.
- Status moves through canonical task status API.
- Subtasks, comments, archive, reopen, and archived-task recovery through canonical task APIs.

## Current Limitations

- Full account authentication is still pending.
- Project/list editing and archiving screens are still pending.
- Browser accessibility and responsive visual verification must be completed before public release `PASS`.
